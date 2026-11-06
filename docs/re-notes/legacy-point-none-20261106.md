# Public legacy POINT/POINT with MIP NONE — 2026-11-06

The retained public failure from `094782345` is repaired without changing its independent pixel oracle, tolerance 2, public state sequence, or texture upload policy. Ordinary fixed-function 2D triangle samplers now evaluate texture coordinates at the D3D integer pixel center even when no mip atlas is selected.

## Reproduction and cause

Under the explicit coordinator grant at 20:50:10 UTC, the unchanged `test/test-legacy-public-mip-webgl.js --combined --combined-point-none-probe` reproduced direct WebGL1 pixel (2,3): `[136,20,124]` versus `[24,20,28]`, GL error 0. Evidence is `scratch/runs/20261106-legacy-point-none/original-repro/`; its result is losslessly compressed as `result.json.gz`. Both shipped modules were hash pinned; software passed before the first direct GL failure.

Read-only diagnostic wrappers then traced public COM writes through native descriptor fields 45–47, `D3DIMGpu._texture`, backend selection, and generated shader sources. A fresh device with legacy POINT and explicit MIP NONE failed as its first draw. This rejects a transition-only or stale sampler explanation. The descriptor was `[MIN=1,MAG=1,MIP=0]`, the image had one level and no `clampMipChain`, and `mipStages` was empty. `withMipSampling` returned the original shader, bypassing the UV correction already used by mip samplers.

The fixed triangle coverage convention retains a 1/16-pixel translation. Before repair, every traced non-atlas readback matched the unchanged analytic oracle evaluated at `(x+1/16,y+1/16)`. At (2,3), base-level U in texel units was about 6.94883 at the integer center and 7.09748 at the shifted center: columns 6 and 7 have the two observed colors. Reversed gradients cross the boundary in the opposite direction, and a perspective boundary case also fails. Neighboring samples include both matching and failing texels. The 42-case diagnostic retained 9 failures before repair and none afterward; `coordinate-analysis.json` records individual UVs, actual colors, predictions, descriptors, sampler uploads, and shader selections. Magnified NONE and POINT-mip samples retain identical level-zero answers.

## Repair and regression

`lib/d3d9-backend.js` selects ordinary sampler center correction independently of `mipStages`. Submitted TL Q/U/V planes now also cover non-atlas samplers. `lib/d3d9-shader.js` emits a small center-evaluation helper that calls ordinary `texture2D`; it does not select mip uploads or introduce mip uniforms. Other eligible affine inputs use the existing numerator/reciprocal-W correction, with derivative capability checked only when required. The fresh repaired trace still records one level, POINT/POINT/MIP0, and empty `mipStages`, with `centerStages=[0]`.

The public fixture adds `--point-none`: fresh-device NONE, explicit overrides after legacy6, later legacy3, LINEAR/NONE and POINT/NONE restoration, reversed and perspective gradients, adjacent samples, and magnified NONE/mip restoration. Held Worker batches preserve old rendered pixels while live public state changes. Read-only descriptor checks distinguish submission state from current live state. An initial new assertion incorrectly compared queued pixels with live state; its rejected run is preserved in `point-none-matrix/result.json.gz`, and the corrected test checks both descriptors separately without relaxing the pixel or queue guards.

The new rendered fault control removes only the center correction in the actual served executor shader. It reproduces an oracle failure on every GL route while retaining the POINT/POINT/NONE descriptor. A public MIP perturbation supplies a separate rendered negative on software and GL. Existing combined enum3/4/5/6, forced texel/mip/swapped-enum negatives, stale-child upload rejection, GL errors, no-fallback Worker identity, immutable queue state, retirement, HTTP isolation, and public COM guards remain active.

| Matrix | Route/module cells | Positive pixel observations | Rendered negatives | Maximum channel error |
| --- | ---: | ---: | ---: | ---: |
| New POINT/NONE | 10 | 434 | 18 | 0.806655 |
| Original combined probe | 10 | 264 | 30 | 0.970242 |
| Existing solid/spatial mip | 20 | 378 | 38 | 1.772440 |

Every matrix exercises **both shipped modules** through software, direct WebGL1/2, and owning Worker WebGL1/2. Numerical before/after readbacks and both complete module contact sheets were personally inspected at original resolution. The module sheets are byte-identical. The independent oracle block SHA-256 remains `5d9130a30e7bfea0198da5241f0e325466aaf26ce0cfd5f65a3b077601a8b5d3`; tolerance remains 2. No expected pixels, native decoder, private state, receiver behavior, or stale-upload acceptance changed.

Focused native mip (38 observations), indexed texture, shader lowering, backend validation, public plan controls, and `flock /tmp/wine-build.lock bash tools/build.sh` passed. `qualification-summary.json`, command records/logs, and `qualified-source.json/.patch` retain exact tested identities. Source is Git `0bb6a85bac412a134072096b68967f4b09b32607` plus the recorded binary patch, including the new note's separate patch. Shipped module SHA-256 values remain `280014368b95a768bd31397971715f5d95089c3a22d018758b5d58f3d4a1650e` (standard) and `7d476f1d52fdc4538de94a436df69164eb02df26285c3a50a2b0516ec4996eca` (compat). The change is in the renderer JS; no source tree archive was created.

To reproduce, set the fixture's documented `LEGACY_PUBLIC_MIP_EVIDENCE`, `LEGACY_PUBLIC_MIP_MODULE_DIR`, `LEGACY_PUBLIC_MIP_SOURCE`, and `LEGACY_PUBLIC_MIP_MODULE_MANIFEST` to a new evidence directory and matching pinned shipped modules. Run `node test/test-legacy-public-mip-webgl.js --combined --combined-point-none-probe` and `node test/test-legacy-public-mip-webgl.js --point-none`. The retained run uses `modules.json` as its manifest.

## Limits and handoff

Windows last-writer render/stage alias semantics, physical GPU conformance, historical27/game coverage, malformed chains, other dimensions/formats, and arbitrary programmed/projected/bump/cube sample arguments remain unqualified. Existing conservative input exclusions remain in place. No game, Windows, or physical GPU claim follows from these generated pixel regressions.

No boxes were used or assigned (ID/state/expiry/ownership null). Owned process/port/profile/lock cleanup, publication, artifact identities, and final scope are recorded in the run's root `result.json`, published last after cleanup. Runtime/source/build ownership returns to the coordinator through the append-only FINAL release.
