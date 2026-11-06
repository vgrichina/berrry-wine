# Legacy filter precision repair — 2026-11-06

The software bilinear precision repair and bounded ordinary TL texture-plane repair pass the public solid/spatial matrix on both shipped modules, through software, direct WebGL1/2, and owning-Worker WebGL1/2. The default matrix and separate two-triangle batch matrix each pass 20 cells and 38 rendered negative controls (946 positive pixel observations combined). The original analytic oracle, tolerance 2, default geometry, compiler protections, and runtime root identity checks are unchanged.

Evidence is in `scratch/runs/20261106-legacy-filter-precision/`. Final source is recorded against main `e018e745e65ccf10ff7b5f4ea666ea4ddc7702e6` in `qualified-source.json` and `qualified-source.patch`; `final-qualification-summary.json` summarizes the two final matrices. Git plus the exact binary diff is the source archive. `qualified-module-manifest.json` pins the rebuilt modules:

| Module | SHA-256 | Bytes |
| --- | --- | ---: |
| wine-assembly.wasm | 43a0097ab79e1e9102d6f12411485a359ebe10b03af5fcf22675b75ad701a081 | 2180377 |
| wine-assembly.compat.wasm | 7219c6f2d7bcf6f91975a8b3bb9fbac35cbc5933c8fc47fe5d4a44b31f1c7a46 | 2183023 |

## Causal software repair

The predecessor traced the actual included fragment sampler stages; its evidence and retained patch were reviewed before application. A fresh public software baseline reproduced pixel (30,1) = `[103,113,95]` against ideal `[103.220778044,113.924726814,97.215804982]`, outside tolerance. `baseline-native.json`, its command log, and `baseline-harness.patch` retain the replay.

`d3dim_bilerp` now carries fractional horizontal results through the vertical blend in f32x4 lanes, truncating only when packing the final UNORM8 result. The equal-texel fast path remains. The predecessor candidate's final rounding addition failed the existing RGB565 mixed-key assertion in `test-d3dim-indexed-texture.js` (1024 versus unchanged expected 992); that failed candidate and log are retained. Final truncation fixes this regression without changing its expectation. Final steep output is `[102,113,96]`; the reversed-gradient case is `[49,104,100]` against `[49.24,104.68,100.89824]`.

## Causal GL repair and batch scope

Reconstructing affine N/Q at integer centers fixes the coverage translation's sampling displacement without moving raster positions. The first actual GL matrix then exposed a separate half-mip error: spatial fractional POINT mip bilinear produced `[111,123,92]` instead of `[130.232081,101.198441,114.773960]`. The failure remains in `matrix/result.json` and `public-matrix.log`.

The actual submitted float32 vertices imply squared maximum footprint `8.000000611255494`, on the expected side of the nearest-mip boundary. Run-local shader diagnostics measured the interpolated finite differences below 8 (approximately 7.999996 and 7.999974), with lambda below 1.5. Thus this was derivative precision loss, not an oracle input error. `gl-lod-diagnostic.log` preserves the initial numeric diagnostics and submitted vertices; `gl-plane-diagnostic.log` and `gl-lod-after-planes.json` preserve the corrected result. The second diagnostic reused its output names; `diagnostic-recovery-note.json` records which first-run JSON/images were overwritten and which command log remains authoritative.

For supported ordinary TL input, the backend now computes Q/U/V planes from submitted vertices, and the fragment shader evaluates their quotient and analytic gradients at the integer D3D center. The actual failing pixel becomes `[130,101,115]`. No LOD epsilon, tolerance increase, or oracle change is used. All final GL steep results are `[103,114,97]`, and reversed-gradient results `[49,105,101]`.

Triangle lists, strips, and fans with multiple primitives are validated as a whole, then submitted in original primitive order with independent plane uniforms. The copy preserves submitted records and winding; texture releases are processed once. Render-target feedback batches retain their existing whole-draw snapshot path. Six indexed/nonindexed topology controls and a truncated-batch rejection control pass. The optional `--batched` matrix submits two triangles with different UV planes in one public draw and checks both; it leaves the default fixture and oracle unchanged.

The submitted-plane path is restricted to ordinary stage-0 raw 2D UVs, TL POSITIONT, positive finite reciprocal W and a finite nondegenerate plane. Guest shaders, native-fixed input, cube/projected/bump inputs, transformed/generated coordinates, multiple bound texture stages, and feedback batches keep their prior fallback contracts. This does not qualify those cases, arbitrary formats/dimensions, or physical GPU implementations. Per-primitive submission may cost performance; no benchmark was run.

## Validation and preservation

`matrix-final/result.json` and `matrix-batched-final/result.json` are PASS, each with both modules, solid/spatial plans, software plus direct and owning-Worker WebGL1/2, and 38 rendered negatives. Worker queue lifetime/retirement controls and HTTP route isolation also pass. The plan commands are controls only. The harness explicitly leaves six broader contracts unexecuted; see each result's `unexecuted` field.

Focused checks passed: `test-d3d9-fixed-top-left-bias.js`, `test-d3d9-shader.js`, `test-d3d9-validate-device.js`, the mirror UV and Worker plan commands, the public mip plan, protected closure, integer-center interpolation, the actual `test-d3d9-fixed-function-shaders.js` render test, native mip, and unchanged indexed texture regressions. The nonexistent predecessor command was not used. `final-height-locked-build.log` and its command record show the final `flock /tmp/wine-build.lock bash tools/build.sh` passed. Final source hashes match all 4061 qualified source pins.

The malformed-root negative replay rejects before any compiler entry. Compiler/protected-root files remain unchanged. `predecessor-artifacts-preserved.json` verifies all 87 indexed predecessor artifacts still match their hashes and sizes. Failed candidates and exact patches remain as evidence; intermediate source-restored records describe earlier states, not the final repaired tree.

Representative final software/direct/Worker captures from both matrices were visually reviewed. These are synthetic texture triangles, with numeric oracle checks providing acceptance; there is no game-progress or performance claim. Production edits, build and browser work began only after ordered predecessor releases and independent cleanup verification (`release-gate.json`). All runtime work and cleanup use the original 13:20:52–14:05:52 UTC window; synthetic reruns were explicitly authorized in the same assignment. No boxes or original games were used. Final process/port/profile/lock/disk checks are in `final-cleanup.json`; publication and terminal status are in the root `result.json`, written last.
