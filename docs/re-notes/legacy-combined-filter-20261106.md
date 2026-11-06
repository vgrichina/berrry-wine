# Public legacy combined MIN filters — 2026-11-06

The four combined MIN enums now pass a generated x86 public COM pixel regression on both shipped modules, using software, direct WebGL1/2, and owning render Worker WebGL1/2. The shared decoder had exchanged enum 4 and enum 5. This repair changes only that decoding and the corresponding old native-test expectations.

## Semantics and reproduced defect

The descriptive names below use texel filtering first and mip filtering second. Public legacy calls use `D3DRENDERSTATE_TEXTUREMIN=18`; the combined values are not texture-stage MIN enums.

| Descriptive combination | Public D3DTEXTUREFILTER | Texels | Mips |
| --- | --- | --- | --- |
| NEAREST_MIPNEAREST | MIPNEAREST = 3 | point | nearest |
| LINEAR_MIPNEAREST | MIPLINEAR = 4 | bilinear | nearest |
| NEAREST_MIPLINEAR | LINEARMIPNEAREST = 5 | point | blended |
| LINEAR_MIPLINEAR | LINEARMIPLINEAR = 6 | bilinear | blended |

Microsoft's [D3DPRIMCAPS filter-cap definitions](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dcaps/ns-d3dcaps-_d3dprimcaps) distinguish MIPLINEAR from LINEARMIPNEAREST; Wine's [public enum declarations](https://github.com/wine-mirror/wine/blob/master/include/d3dtypes.h) and [legacy render-state translation](https://github.com/wine-mirror/wine/blob/master/dlls/ddraw/device.c) agree with this mapping. Static review found prior private-adapter tests asserted the exchanged mapping, while the previous public precision matrix explicitly left combined enums unexecuted.

Before repair, fresh public devices reproduced both failures on both shipped modules. At pixel (2,3), enum 4 returned `[164,131,75]` against `[156.134394,110.394561,84.832687]`; enum 5 returned `[156,110,84]` against `[164.75,131.25,75.75]`. Enums 3 and 6 passed. Successful public draw HRESULTs, guarded stdcall observations, complete readbacks and baseline captures remain in `baseline-readbacks.json` and the baseline PNGs under `scratch/runs/20261106-legacy-combined-filter/`.

## Bounded regression and result

`test/test-legacy-public-mip-webgl.js --combined` uses a five-level asymmetric checker/ramp chain, fractional LOD 1.25, and two independent pixel samples per state. All six pairs of the four bare enum reference vectors differ by more than twice tolerance. Twelve state configurations exercise bare enum restoration, explicit MIP NONE/LINEAR, MIN overrides, and persistent explicit stage precedence when a later legacy call follows stage writes. Three held Worker pairs check immutable queued state. Setters and getters run through generated public COM calls; a fresh device supplies the untouched fallback, without writing invalid zero enums or resetting private state.

The final matrix passed 10 cells, 264 positive observations, and 30 rendered negative controls. Public-call perturbations forcing point texels, nearest mips, or exchanged enums each failed the actual pixel oracle on every route. Existing GL error, Worker identity/no-fallback, queue lifetime, retirement and HTTP isolation controls remain active. The independent oracle source is exactly unchanged (block SHA-256 `5d9130a30e7bfea0198da5241f0e325466aaf26ce0cfd5f65a3b077601a8b5d3`), tolerance remains 2, and maximum final channel error is 0.970242. Numeric readbacks and both module contact sheets were personally inspected.

Focused native mip (38 observations), unchanged indexed texture, public plan controls, and `flock /tmp/wine-build.lock bash tools/build.sh` passed. `matrix/result.json`, `qualification-summary.json`, command logs, and `qualified-candidate-source.json/.patch` retain exact modules, Git base and working changes. Final module SHA-256 values are `280014368b95a768bd31397971715f5d95089c3a22d018758b5d58f3d4a1650e` (standard) and `7d476f1d52fdc4538de94a436df69164eb02df26285c3a50a2b0516ec4996eca` (compat). Git plus recorded binary diffs, including this new file's patch, is the source archive.

## Remaining unsupported or unqualified behavior

The first matrix passed software, then failed standard-module direct WebGL1 after legacy 6, explicit MIP NONE, and later legacy 3: pixel (2,3) was `[136,20,124]` instead of `[24,20,28]`, with GL error 0. `matrix-point-none-failure/` and `failed-point-none-source.json/.patch` preserve that failure. Equal POINT min/mag with NONE selects the older non-atlas path, consistent with a separate UV sampling issue; its precise cause was not qualified. The passing matrix instead tests NONE persistence with later legacy 4. The failing variant remains explicitly available as `--combined --combined-point-none-probe`; it is excluded from the supported result, not repaired or declared passing. Later routes for that variant remain unexecuted.

Persistent stage precedence here is the emulator's supported ordering contract, not a qualification of Windows last-writer render/stage alias behavior. Stage MIN overrides without an explicit MIP, malformed/partial chains, other formats/pitches/dimensions, physical GPUs, games, and complete legacy or 27-game coverage remain unqualified. No receiver maps, error clearing, private state, oracle tolerance, compiler controls, or broader renderer paths were changed. Runtime began only after the coordinator's explicit grant; root `result.json` is written last after publication and cleanup verification.
