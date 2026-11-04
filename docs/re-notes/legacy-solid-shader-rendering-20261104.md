# Experimental solid transport reaches actual WebGL pixels

The released predecessor implementation now passes actual WebGL1/2 compiler,
rendered coverage/interpolation and the unchanged public spatial mip oracle.
This task deliberately reclaimed and preserved the uncommitted backend and
focused test described in `legacy-solid-coverage-transport-20261104.md`.
It publishes those implementation changes, including the predecessor's offline
WebGL1 array-index correction, after rendering them. No additional runtime
compiler failure arose in this task. `solidCoverageTransport: true` remains an
explicit experimental `Device` constructor option; the default is unchanged.
This is not a normal-path or full27 repair.

## Concrete implementation and dependency fix

The backend submits one conservative invocation rectangle per original triangle,
including indexed list/strip/fan parity. Immutable original inputs travel in
uniforms; GPU vertex replay and homogeneous clipping produce conservative
bounds and primitive-local coverage. Fragment edge ownership uses integer D3D
sample locations, while original XYW planes independently reconstruct color,
UV and device depth. Ordinary 2D mip derivatives use numerator/Q transport.
Blend and depth tests remain GL operations after the final coverage discard.

The original missing strict interior cannot be recovered by fragment-only
interpolation correction. This mechanism supplies those missing invocations
without shifting input geometry. The first predecessor WebGL1 rejection was
`solid_scratch[count]`: fragment arrays require constant or loop-symbol
indices. `solid_append` now scans loop-indexed slots with a destination
predicate. Both append sites use it. The original first-error log/shaders remain
intact in `scratch/runs/20261104-legacy-solid-coverage-transport/`; the earlier
standalone glslang success is not used as WebGL acceptance.

## What actually ran

Evidence: `scratch/runs/20261104-legacy-solid-shader-rendering/`.
The run driver, exact source seal, Git SHA, initial backend diff and new-test
patch reconstruct the tested revision. The browser driver is run-specific;
recovery uses its retained file and the predecessor's existing pinned runtime.
Only two changed small source files and run-specific driver/seal were uploaded.
The intact 37-file dependency closure, Puppeteer 24.31.0 actual import, static
server import, both module hashes, served script bytes and HTTP isolation
passed before Chrome. No source archive or media copy was made.

One browser ran 2026-11-04 05:13:56.950Z–05:14:10.059Z, Chrome
151.0.7922.108. There was no retry, reload, second browser or post-browser
production edit. The backend SHA-256 tested and committed is
`d31cc9432b6c111946aeb5d2c43a8e72107f755cddc2e30cbedaa721d4bedd16`.
The later focused-test additions validate retained evidence; the rendered
fixture function is unchanged from the tested revision.

CDP reports SwANGLE/SwiftShader; public direct-route observations retain an
Intel/Mesa renderer string. This discrepancy is unresolved. These are actual
WebGL compiler and pixel tests, not a physical-GPU portability claim. There
is no application CPU rasterizer or fallback added by this change.

In that browser, the option-disabled control reproduced omitted strict interior
at (4,4) for (0,0),(8,0),(0,8+1/32): RGBA 0/0/0/255. Its real queued Worker
public MIN LINEAR draw reproduced 121/50/107 against the unchanged
113.752/42.28/103.404992 oracle, tolerance 2.

The candidate passed both actual WebGL versions:

- Strict interior restored to 255/0/0/255.
- Both shared diagonals, horizontal/vertical/oblique seams, both winding orders,
  and alpha-blend ownership against an independent screen-space edge oracle.
- Perspective color with independently authored rational weights.
- Viewport-generated left clip edge and oblique near clipping, both windings.
- Hardware affine-depth occlusion at .44 and .46 around the independently
  expected .45 depth, with varying RHW and both windings.

There are 30 direct cases and 1,142 grid comparisons per version. Seam blending
is ownership-sensitive; affine-depth occlusion is tested separately. Full seam
ownership under all depth/stencil modes remains unverified. Captures were
recovered and inspected, but direct screenshots occur after device destruction
and show a cleared canvas; raw readback assertions are the coverage evidence.

After direct cases, both retained modules passed the actual queued Worker and
direct public routes under WebGL1 and WebGL2: eight cells, 120 observations,
three queued sampler transitions in each Worker cell, zero reported errors or
fallbacks. MIN LINEAR now reads 114/42/103 in every cell against
113.752/42.28/103.404992, tolerance **2**. The unmodified public fixture also
checks magnification/minification separation, point/linear transitions,
fractional/trilinear mips and perspective UV/mip gradients. No fixed LOD,
UV-only adjustment, global geometry shift or weakened oracle is used.

Module files are referenced at existing `build/` paths, with full SHA-256:

- `wine-assembly.wasm`: `1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`
- `wine-assembly.compat.wasm`: `74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66`

## Offline checks and scope

The actual `Device.draw` transport regression independently rejects the original
main backend (two submissions instead of four), then passes twelve candidate
transport combinations and 48 submissions, preserving source bytes and inputs.
The new `--render-evidence=PATH` arm rejects missing Worker cells, stale backend
hashes, old witness pixels and reported fallbacks. It validates the two direct
versions and eight public cells separately from submission mocks.

Focused transport/evidence, original-backend and evidence negative controls,
retained interpolation diagnostic, top-left controls, plan cache, backend
validation-only, fixed shader and position-type tests, test-tier membership,
and `flock /tmp/wine-build.lock bash tools/build.sh` pass. The ordinary
`--require-unbiased-raster` and `--require-integer-center` gates still exit 1;
their failures are retained and not reclassified as passing.

Recheck retained rendering without launching a browser:

```
node test/test-legacy-solid-coverage-transport.js --render-evidence=scratch/runs/20261104-legacy-solid-shader-rendering/browser-result.json
```

Before any promotion, the following remain unresolved: full-domain clipping and
snapping/exact-sign ownership; W=0/eye-plane degeneracy; nonlinear, projected
and cube gradients; programmable mutable-global reset during vertex replay;
user clip distances and hardware uniform limits; culling/two-sided stencil,
alpha/discard and guest depth-output interactions; transformed/programmed
rendered coverage beyond these fixtures; hardware portability; and performance.
The current per-primitive draw and repeated fragment vertex replay are expensive
and unqualified for normal gameplay. Narrow successful tests do not resolve
these limits. No game or full27 run occurred.

The assigned box `bx_e5cc38rs` was independently verified RUNNING by actual
exec, API idle/healthy/hydrated, expiry 2026-11-04T05:40:37.336Z. Browser/server
closed normally; /proc inspection found no remaining Chrome/Chromium/Node task
process. Unique results and ten captures were recovered before 05:30Z. The
coordinator retains runtime/shutdown ownership; this worker performed no
allocation, resume, stop/delete, subworker launch or public deployment.
