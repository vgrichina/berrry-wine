# Public DD7/D3D7 MIRROR independent U/V: explicit WebGL1

PASS on both retained modules, through direct production WebGL and real
GuestWorkerLink → RenderWorker queued rendering. Every observed context reports
`WebGL 1.0 (OpenGL ES 2.0 Chromium)`. Physical hardware and full27 remain unknown.

| Module | Direct exact RGB observations | Queued exact RGB observations | Held batches | Rendered negatives rejected |
| --- | ---: | ---: | ---: | ---: |
| Canonical | 480 | 1,440 | 480 | 20 |
| Compatibility | 480 | 1,440 | 480 | 20 |

The unchanged public x86 DD7/QI D3D7/CreateSurface/CreateDevice7 vtables,
independent continuous-coordinate oracle, signed periods/seams, four texels,
all nine independent WRAP/MIRROR/CLAMP U/V pairs, point → linear → point,
public state readbacks and exact caps checks come from the predecessor fixtures.
No tolerance or assertion was weakened. Direct pixels additionally match
`gl.readPixels`; every queued observation checks endpoint identity, actual
context VERSION and zero GPU errors, fallbacks and native/fallback rasterizer
draws. Every held production batch changes live state before draining and
checks the captured old state followed by the new state.

Each module/path rejects WRAP-for-MIRROR, stale U, stale V and both coupled-axis
policies under point and linear filtering. All 40 controls reach successful
public DrawPrimitive7 and an actual RGB mismatch at PIXEL ORACLE, with WebGL1
identity already checked. Bootstrap failures cannot qualify these controls.

## First failure and repair

The cheap explicit-version control first failed before browser execution:
`legacy device forwards explicit WebGL version: undefined !== 1`.
`D3DIMGpu` discarded the requested version when constructing D3D9Backend.Device;
the legacy worker adapter also discarded endpoint options. The repair forwards
`webglVersion` through both constructors into the existing D3D9Backend
`webglVersion` → WebGLBackend `apiVersion` route. Omitted versions retain the
existing automatic selection. Worker fence stats now expose actual
`gl.getParameter(gl.VERSION)` alongside renderer and endpoint identity.
No sampler defect was observed after this option-forwarding repair.

The fixture accepts `--webgl=1`, `--webgl=2` or `--webgl=auto` (default).
Explicit requests assert actual VERSION throughout direct/queued observations.
Cheap controls cover constructor forwarding, independently reported worker
VERSION, invalid arguments and unavailable explicit-version context creation:
WebGL1 never requests WebGL2, and WebGL2 never requests WebGL1.

## Runtime, source and recovery

Baseline sampler fixture: `c6884b0987e358aaa3aadeb367d13a445f217b02`.
Actual staged source: `f3ba696fb842a3295d8e1d99f4cc15c15ad6d1ec` plus
`scratch/runs/20261104-legacy-mirror-webgl1/relevant.patch`. The 35 minimal
predecessor inputs passed hash verification before staging; only the fixture
and three repaired production scripts were uploaded. `source-seal.json` pins
all resulting inputs. No unchanged module rebuild was used to reproduce:
the mandatory subsequent locked build independently reproduced both hashes.

- Canonical (2,143,712 bytes):
  `1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`.
- Compatibility (2,146,325 bytes):
  `74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66`.
- Existing original bootstrap `test/binaries/calc.exe`:
  `cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b`.

Chrome151.0.7922.108 / Node24.22.1 on assigned `bx_4hx68dxv`.
CDP identifies ANGLE Vulkan SwiftShader Device (Subzero), driver5.0.0;
page/worker Intel/Mesa renderer strings do not establish physical hardware.
One browser attempt ran 03:51:49.767Z–03:53:07.581Z (77.814 seconds).
Helpers closed at03:53:07.582Z. Stable final recovery verified all eight unique
files (result, log, four captures, both modules) by full SHA-256, and subsequent
checks confirm browser15954/driver absent and 35/35 source pins unchanged.
Boat's multiline command receipt caused a local JSON parser error after
execution; `driver.log` preserves it. Runtime result is PASS; no browser retry.

The box remains RUNNING/APIidle, healthy and hydrated, expiry
`2026-11-04T04:38:03.251Z`; shutdown ownership returns to the coordinator.
Recovery and cleanup completed before04:28Z. No lifecycle mutation, local
Chrome, subworker, public deployment, source archive or media copy was used.

## Tests and limits

Run evidence: `scratch/runs/20261104-legacy-mirror-webgl1/`.
`verification.json` checks 3,840 exact observations, 960 held batches, 40 rendered
negatives, actual WebGL1 versions and retained module hashes. The first failing
control, repaired planners, relevant binary diff, new note patch, full build,
focused logs and stable recovery manifest are retained there.

PASS: explicit-version controls/planners, predecessor planner, D3DIM batching,
depthless targets, points, generic GPU backend, shared render-worker protocol,
tier membership and `flock /tmp/wine-build.lock bash tools/build.sh`.
The existing fallback-counter test fails `fallbackDrawTexture: 0 !== 1` with
both baseline and repaired D3DIMGpu; both logs are retained, with no assertion
change. This is an existing test limitation, separate from the passing pixel
contract. WebGL2 runtime remains the predecessor's result; its explicit-option
controls pass here. Other sizes/formats, mip/perspective behavior, physical
GPUs, original games/full27, resource lifetime and the rejected queued-texture
diagnostic are unexecuted or excluded.

Reproduce on an authorized box with the sealed inputs and existing dependencies:

```sh
LEGACY_MIRROR_GPU_SOURCE=<full-Git-SHA> \
LEGACY_MIRROR_GPU_MODULE_DIR=<retained-module-directory> \
LEGACY_MIRROR_GPU_EVIDENCE=scratch/runs/<fresh-id>/browser \
  timeout --kill-after=15s 840s node test/test-legacy-mirror-gpu-worker-contract.js --webgl=1
```

`--plan --webgl=1` runs cheap controls only and cannot qualify browser coverage.
