# Batched solid rendering: first failure and offline correction

This task is **incomplete**. The exact batching backend from
`ac68fb71658ac9a1d383a1715606135212038aa2` compiled and rendered the retained
30 direct cases under actual WebGL1, then failed the new multi-batch alpha
overlap oracle. The browser stopped at that first unexpected failure. The
correction described below is uncommitted WIP and has **not** been compiled or
rendered by WebGL. No second browser, reload, gameplay, default enablement,
full27, performance, or physical hardware claim follows from these results.

## Actual run and failure

Evidence is in `scratch/runs/20261104-legacy-batched-native-rendering/`.
`source-seal.json`, `git-sha.txt`, and `browser-tested.patch` reconstruct the
tested source from Git commit
`84cf1bb1e1b85c0abb6f05c86cc4e1cc77aa028b`. The tested backend SHA-256 was
`76d1e3a2d574510dcb4b7e6dd1150925310e206972dc554d3e3a7c323f9ca49a`,
identical to that file at `ac68fb71658ac9a1d383a1715606135212038aa2`.
The tested focused fixture SHA-256 was
`bdf19dd833447218e5a7877c5881cd44b319b8eb65e14a474be034bd5aa34862`.
The final relevant patch records the later offline correction separately.

The assigned fresh box had no project or dependency closure. Coordinator
clarification on the messageboard at 05:39:49Z authorized the recipe's initial
three binary inputs once. Individual inputs from the existing 37-file recipe
were staged; no source archive, tree snapshot, docs, or media bundle was made.
The exact retained package lock was installed with `npm ci --ignore-scripts`
and `PUPPETEER_SKIP_DOWNLOAD=1`. The actual imported Puppeteer version was
24.31.0, from
`/home/user/legacy-solid-browser/node_modules/puppeteer/lib/cjs/puppeteer/puppeteer.js`.
The package-lock SHA-256 is
`a9e5d5ae9b98bf460897b8090602dfe46dd9baca27bf7ed9bb2d0fb096c74d1d`.
Both retained modules passed actual public Worker bootstrap before Chrome.
The driver verified staged hashes, served script bytes, module bytes and HTTP
isolation before launching the browser.

Chrome 151.0.7922.108 ran once, from 05:41:58.637Z to 05:42:03.237Z.
CDP reports SwiftShader/SwANGLE. The old public Worker reports an Intel/Mesa
identity; the discrepancy is retained, not interpreted as physical hardware.
There was no compiler rejection in the reached WebGL1 programs.

The option-disabled controls reproduced the absent strict interior
RGBA 0/0/0/255 and the old public spatial MIN LINEAR pixel 121/50/107. The
unchanged public oracle was 113.752/42.28/103.404992 with tolerance **2**.
The candidate restored the strict interior, then passed all 30 retained direct
cases and 1,142 grid comparisons under WebGL1. Its shaders already contained
the eight-primitive bank selection, even when those cases submitted one
original triangle at a time.

The new fixture issues 19 distinct original triangles through actual
`Device.draw`, with rational inputs, near clipping, and successive banks.
Its opaque ordered grid comparison completed before the alpha-overlap draw.
The latter failed at integer sample (4,14):

```
ordered alpha overlap pixel 4,14
actual   126,101,131
expected 125,101,134
```

The oracle tolerance was not changed. The failed fixture throws before returning
its detailed submission/program arrays; those arrays and a raw failed grid are
therefore unavailable. Its exact source, saved first error, completed direct
results and old controls remain recoverable. No screenshot was reached.

## Offline diagnosis and implemented WIP

The failing sample lies exactly on the original inclusive edge from (5,26) to
(3,2): its integer equation is `12*x = y+34`. The first near-clipped triangle
in that group generates an endpoint approximately (3.166667938232422,4).
Re-evaluating the surviving original edge using that rounded endpoint changes
its Float32 edge value from zero to **-1/65536**, incorrectly excluding the
sample. Primitive 8 also gets a negative value; later unclipped controls retain
zero. `diagnose-edges.json` preserves this numerical reproducer. This supports
the edge-sign diagnosis; it is not a substitute for capturing every fragment
or an assertion that this accounts for every channel of the blend result.

The backend WIP keeps the existing conservative clipped invocation bounds.
For three positive original W values it evaluates surviving original edges
using the original projected vertices. Near/far coverage uses the original
homogeneous plane distances `w+z` and `w-z`, combined with the original XYW
coefficients. Their gradients determine directed top-left ties. A triangle
entirely on a clip plane has zero distances and creates no artificial cut.
The existing clipped-polygon path remains for eye-plane crossings.

This introduces no epsilon, displaced geometry, CPU rasterizer, fixed LOD,
public-oracle change, or new GL state handling. Primitive submission order,
batch capacity, original attribute replay, rational interpolation, affine depth,
and numerator/Q mip gradients retain their mechanisms. Blend, depth and stencil
still act after the final coverage discard. These are implementation properties,
not rendered confirmation of the offline change. Original projected edges can
still suffer other floating-point cancellation; full-domain exact-sign coverage
and eye-plane behavior remain unresolved.

The focused test adds an offline Float32 historical-clip reproducer. It checks
the generated corrected source and evaluates the emitted scalar halfspace
helper against independent near/far, horizontal/vertical, constant-boundary,
inside/outside cases. A reversed tie-direction mutation rejects. These checks
do not execute a GLSL compiler or establish GPU precision behavior.

The exported `renderedBatches` fixture also contains planned real-pixel tests
for constrained three-primitive banks, depth, scissor, rational color, stencil
increments, two-sided stencil, culling and indexed strip/fan parity. Its selector
and reversed-order controls must fail on the independent pixel oracle rather
than compilation. **Those later cases and controls were not reached.**
`batchRenderedEvidence` requires all cells and an exact source match; the
retained failed run correctly rejects as acceptance evidence.

## Checks, recovery and remaining work

Actual Device submission tests pass for the offline correction. The exact
pre-batching backend still passes its explicitly unbatched control arm.
Focused interpolation, top-left diagnostic, plan cache, fixed shaders, position
types, shader/unsupported cases, backend validation and tier checks pass.
The locked full build passed before the browser; the final locked build result
is retained in `build-final.log` after the offline source edits.

Two command mistakes are preserved: `--validate-only` was corrected to
`--validation-only`; the former stopped at missing local Puppeteer import and
launched no browser. A nonexistent `tools/check-test-tiers.js` was corrected to
`tools/test-tiers.js --check`. The browser command returned an attached-process
receipt that the orchestration helper rejected; the browser's saved final
failure and closure timestamps, rather than that receipt, establish the result.

Unique remote logs and results were recovered by 05:42:46Z. Bootstrap produced
duplicate module files; their hashes were proved equal to the existing build
paths and duplicate local evidence copies were removed. The references are:

| Existing input | SHA-256 |
| --- | --- |
| `build/wine-assembly.wasm` | `1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58` |
| `build/wine-assembly.compat.wasm` | `74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66` |
| `test/binaries/calc.exe` | `cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b` |

Box `bx_vcdyb63z` was independently verified by actual exec and API health:
RUNNING (API idle), healthy, hydrated, expiry 2026-11-04T06:33:43.769Z.
The 05:45:27Z post-closure exec found no remaining task Chrome/Chromium/Node
processes. The browser and private server closed in the driver's finally block.
The coordinator retains shutdown ownership; the box is left running. This
worker performed no allocation, resume, stop/delete, subworker launch, successor,
public deployment, or Heroes II run.

The concrete blocker is the first-failure/no-second-browser constraint. The
offline fix needs actual WebGL1 and WebGL2 compilation and the complete retained
and new pixel matrix. Candidate public Worker/direct mip pixels under both
modules and versions were never reached in this run and remain unqualified;
the original public test and tolerance are unchanged. Hardware uniform limits,
programmable mutable-global replay, W=0, broader clipping/snapping, nonlinear
gradients, gameplay and performance remain additional gaps. The three owned
files stay uncommitted WIP pending that validation; no new main commit or push
is claimed.

## Completion by legacy-clipped-batch-fix, 2026-11-04

The earlier incomplete/WIP status above describes the predecessor run. The
handed-off positive-W clipping correction is now **rendered and validated**;
the experimental transport remains opt-in. This completion used the same
retained box, dependency installation, canonical and compatibility modules.
Evidence is in `scratch/runs/20261104-legacy-clipped-batch-fix/`.

The executed backend SHA-256 was
`8048dd6b7d517461d02321bc80fa31b8b1d25789bd2fefaa2c8b94e530a639d5`,
exactly the predecessor's final source seal. No further backend change was
needed. Original projected edges determine positive-W coverage; original
homogeneous near/far halfspaces determine the cut. Rational attributes,
affine depth, numerator/Q mip gradients and primitive order retain their
existing equations. The fixture now preserves reached reports, the first
failed pixel/framebuffer, submissions and generated programs before throwing,
and records the historical (4,14) sample even on success. Neither oracle nor
tolerance changed.

Before Chrome, actual remote imports, the pinned Puppeteer 24.31.0 lock,
every staged input hash, served script bytes, both module bytes, HTTP isolation
and the focused Device transport fixture passed. Only the changed backend,
fixture and small run-specific driver/seal/control inputs were staged. The
accepted option-disabled controls were referenced from the predecessor's
result, with explicit provenance; they were not rerun. An initial run-input
upload accidentally doubled an absolute destination prefix; preflight stopped
at a missing driver before any browser launch. Correcting the destination
passed preflight. The failed command remains in the command log.

Exactly one Chrome 151.0.7922.108 browser ran from
**05:53:35.317Z to 05:53:58.637Z**, closing normally with no reload or second
launch. Its CDP renderer was ANGLE/SwiftShader (SwANGLE), not physical GPU
qualification. All required candidate cells passed:

| Rendered check | Actual result |
| --- | --- |
| WebGL1/2 direct matrix | 30 cases and 1,142 pixels per version; 2,284 total |
| Default eight-primitive and constrained three-primitive banks, both versions | 13 grids per cell; 27,508 comparisons total |
| Historical alpha overlap at (4,14), all four batch cells | actual 124/100/134, expected 125/101/134; unchanged tolerance 2 |
| Batch transitions | Ordered clipping, alpha, affine depth, scissor/reset, rational color, stencil increments, two-sided stencil, disable transition, both cull windings, indexed strip/fan parity passed |
| Selector-collapse and reversed-order mutations | All four controls reached and failed the independent pixel oracle, without compiler failure |
| Original public mip oracle | Worker and direct WebGL, versions 1/2, canonical and compat modules: all eight cells, 120 observations passed |
| Public spatial MIN LINEAR witness | 114/42/103 against 113.752/42.28/103.404992; unchanged tolerance 2 |

`rendered-evidence.log` validates the complete matrix against the executed
backend and fixture hashes. Local focused interpolation, top-left diagnostic,
plan cache, fixed shaders, position types, shader/unsupported, backend
validation and tier checks passed. The required
`flock /tmp/wine-build.lock bash tools/build.sh` passed after rendering, and
rebuilt module hashes match the retained tested modules. This is the same
worker's implementation/test/publication, with no separate acceptance task.

Thirteen unique remote artifacts, including the browser result, log and ten
captures, were recovered and SHA-256 checked by 05:54:19Z, before either
deadline. No source archive, repeated media or module copy was recovered.
The direct WebGL1 screenshot and compat Worker WebGL2 screenshot were
personally inspected; the latter shows the expected textured triangular
region. The direct screenshot is a teardown artifact after fixture device
destruction and does not establish coverage; the recorded readPixels matrix
provides that evidence. Git SHA plus the relevant binary diff and the new
note patch reconstruct the source; `final-source-seal.json` and
`final-artifacts.json` record exact hashes.

Box `bx_vcdyb63z` remains RUNNING (API idle), healthy and hydrated, expiry
**2026-11-04T06:33:43.769Z**. Runtime shutdown ownership returns to the
coordinator. No box allocation, resume, stop/delete, local heavy runtime,
subworker, successor, public deployment or Heroes II run occurred.
Eye-plane crossings retain their prior path; full-domain exact-sign coverage,
mutable programmable globals, nonlinear gradients, physical GPU limits,
gameplay and performance remain outside this completed clipping correction.
