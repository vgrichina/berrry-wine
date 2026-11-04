# Public legacy MIRROR / independent U/V: WebGL and queued Worker

`D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013`: **PASS on both retained production
modules**, using actual public DD7/QI D3D7/CreateSurface/CreateDevice7 x86
vtables and production rendering. No production addressing defect was found.
Full27 remains open. Resource-lifetime work and the rejected queued-texture
diagnostic are outside this test.

| Module | Direct WebGL exact observations | Queued Worker exact observations | Held batches | Rendered negatives rejected |
| --- | ---: | ---: | ---: | ---: |
| Canonical | 480 | 1,440 | 480 | 20 |
| Compatibility | 480 | 1,440 | 480 | 20 |

All four positive arms report zero errors and zero software fallbacks, with
every draw counted by the GPU backend. Worker arms additionally assert zero
native and fallback software rasterizer draws at each observed pixel.

## Contract and actual routes

`test/test-legacy-mirror-gpu-worker-contract.js` reuses the checked adaptation
from `test/test-legacy-mirror-uv-contract.js` at `b4f3abfb8`, which retains the
public COM fixture from `test/test-legacy-texture-rendered-contract.js`.
Every adaptation seam must occur exactly once. Neither predecessor is edited.
The assigned new filename is registered as an E2E test in `tools/test-tiers.js`.

The independent continuous-coordinate oracle, sixteen signed coordinate
pairs, four distinct texels, exact X8R8G8B8 RGB comparison, exact caps
address0xf7/texture0xf7df, and per-axis public GetTextureStageState7 readbacks
are reused unchanged. Each arm runs all nine U/V combinations of WRAP,
MIRROR and CLAMP through point → linear → point on one device and texture.
Coordinates cover fractional interiors, positive/negative periods, and exact
seams at -2, -1, 0, 1, 2 and 3. Expected values do not call production sampler,
shader, descriptor or backend code. No tolerance is used.

Direct WebGL executes `D3DIMGpu`, reads pixels through public Surface7 Lock,
and independently checks `gl.readPixels` at the same target pixel. Queued mode
executes real `GuestWorkerLink` (`/lib/guest-worker.js`) and
`RenderWorker.Manager` (`/lib/d3d-render-worker.js`) with the legacy WebGL
endpoint. After the ordinary 480 draws it holds each production draw batch,
changes the live device to the next state, drains the held batch, and checks
the old state's pixels through the public Lock fence. It then draws/checks
the next state. All 30 cyclic state transitions run at all 16 coordinates:
480 held batches and 960 additional observations per module. Both filter
boundaries, restoration and independent one-axis changes participate.
Actual held message types, live-change flags, public calls, per-pixel fence
stats and render endpoint identities are retained; descriptors are ancillary.

Each backend/module rejects five deliberately broken setter policies under
both point and linear filtering: WRAP for MIRROR, stale U, stale V, V coupled
to U, and U coupled to V. Each control must reach a successful public
DrawPrimitive7 and an actual RGB mismatch at `PIXEL ORACLE`. Direct controls
also require real WebGL readPixels; queued controls require observed WebGL
worker draw stats. Bootstrap or state-readback failure cannot qualify a
negative control. Requested states and the independent oracle stay unchanged.

## Environment and identities

Source baseline: `4c1ecd9398b1e5c5ac3bd8bcc46e24ee89f76cd7` plus the owned
fixture and tier-registration patches. Node v24.22.1, Chrome/151.0.7922.108.
CDP `SystemInfo.getInfo` identifies the actual GPU process as **ANGLE Vulkan
SwiftShader Device (Subzero), driver5.0.0**, implementation
`(gl=egl-angle,angle=swiftshader)`. Page/worker WebGL renderer strings instead
report Intel UHD620/Mesa; those strings do not establish physical hardware.
The executed WebGL route uses WebGL2/OpenGL ES3; physical GPU and WebGL1
coverage are unexecuted. Positive worker arms report endpoint1, API `legacy`,
requested backend `webgl`; stats and the worker scripts' hashes are retained.

Actual tested module SHA-256 (also recovered and compared to the locked build):

- Canonical, 2,143,712 bytes:
  `1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`.
- Compatibility, 2,146,325 bytes:
  `74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66`.
- Original calc bootstrap, existing `test/binaries/calc.exe`:
  `cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b`.

Assigned box `bx_4hx68dxv` was verified/ACKed idle, healthok, hydrated before
use; expiry `2026-11-04T04:38:03.251Z`. One browser attempt ran
03:41:54.175Z–03:42:55.786Z (61.611s); browser8576 and own Node driver are
absent after normal browser/server cleanup, well before04:28Z. Partial live
recovery preceded close; complete stable recovery of nine files with full SHA
verification followed at03:43Z. Thus complete recovery preceded box handback,
but did not precede browser close. Final source/module pins pass35/35. The box remains
RUNNING/APIidle and is handed back to the coordinator, who owns shutdown.
No allocation, resume, stop, delete, public deployment, local Chrome or
subworker was used.

The local execution wrapper failed parsing Boat's multi-line JSON receipt
after execution. Its traceback is preserved in `driver.log`; the recovered
runtime JSON is PASS, with all four positive arms, all40 negative controls
and normal close timestamps. There was no runtime retry or assertion change.

## Evidence and reproduction

Evidence: `scratch/runs/20261104-legacy-mirror-gpu-worker/`. `browser/result.json`
contains full pixels/calls/stats/CDP identity; `browser/` holds both actual
modules and four captures. `verification.json` independently checks3,840
observations,960 held batches and40 negative controls. `source-seal.json`
records the exact Git baseline and35 minimal staged runtime/fixture inputs;
`relevant.patch`, `fixture.patch`, `note.patch` record owned differences.
No source archive or game-media copy was created. The small original calc PE
was the sole executable bootstrap input. `recovery-verified.json` records
stable remote/local artifact SHA equality; `postclose-pins.json` verifies all
staged inputs stayed unchanged.

Cheap predecessor planners, the new adaptation/planner, tier validation and
its focused regression pass. `build.log` records the full mandatory
`flock /tmp/wine-build.lock bash tools/build.sh` PASS.

On an authorized leased box with the pinned runtime scripts, original calc,
Puppeteer25.7.0 and Chrome installed:

```sh
LEGACY_MIRROR_GPU_SOURCE=<full-Git-SHA> \
LEGACY_MIRROR_GPU_MODULE_DIR=<retained-module-directory> \
LEGACY_MIRROR_GPU_EVIDENCE=scratch/runs/<fresh-id>/browser \
  timeout --kill-after=15s 840s node test/test-legacy-mirror-gpu-worker-contract.js
```

`--plan` performs only numerical/adaptation checks. This task does not rerun
software coverage (both modules passed480 exact pixels/10 negatives each in
the predecessor), original-game/full27 coverage, other texture sizes/formats,
mip/perspective behavior, other interface revisions, hardware GPUs or WebGL1.
Those remain explicit follow-up scope; this bounded MIRROR/independent-UV
WebGL2 and queued-worker sampler contract is executed on both modules.
