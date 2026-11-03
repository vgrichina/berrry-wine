# Falling Leaves: corrected shadow alpha on software and browser WebGL

Run `20261103-falling-leaves-paired-shadow-alpha` closes the missing paired
shadow-alpha evidence for registered `scr_fallingl` on committed input
`e1dbee81690cd7e4f424601b07110458517182c6`. Original `FALLINGL.SCR /s` runs
the real guest `d3drm.dll`. No production code or scene asset was changed.
This validates the October 10 correction in
[the screensaver notes](plus98-dx-screensavers.md), not the superseded
interpretation that opaque black shadows were intended.

The canonical module actually served to all four browser launches is
`0a58fd7b9ac82c5303048776f442b15e72528b55ddf85564e0df92fcb1aa384d`.
`source-seal.json.gz`, `source-supplement.json`, `source-input-SHA.json` and
`source-input.tar.gz` retain the committed closure and original input bytes;
`verification.json` checks successful served responses against those pins.
Foreign working-tree changes were excluded with `git ls-tree`/`git cat-file`
on the exact input commit.

## What the alpha evidence establishes

The focused `node test/test-d3dim-lit-alpha.js` passes: an exact material
diffuse alpha of 0.5 produces vertex alpha 128, while opaque, transparent and
missing-material cases retain their expected alpha.

The original scene has a useful quantization detail. Its black shadow material
contains `[0, 0, 0, 0.49803921580314636]`, approximately `127/255`. The existing
two-decimal trace would print this as `diffuseA=0.50`. At actual shadow triangle
execution, the diagnostic captures material handle 28, its 80-byte material,
post-lighting color `0x7f000000`, texture handle 0, alpha blending enabled, and
blend factors 5/6 (`SRCALPHA`/`INVSRCALPHA`). Twelve samples on each route check
this chain. This is preserved half opacity within the original DLL's byte
quantization; it is not the old forced `0xff000000` result.

On actual browser WebGL, the diagnostic also observes lowered shadow payloads
whose vertices all contain black with alpha 127. The fixed-function alpha
stage selects diffuse alpha. Sixteen sampled actual `drawArrays` calls during
those shadow submissions have GL blending enabled with `SRC_ALPHA` (770) and
`ONE_MINUS_SRC_ALPHA` (771). `analysis.json` and the diagnostic frame JSONs
retain the material, vertex, state and GL records.

These probes only read guest memory and observe existing host calls; they do
not change guest state, materials, render state, shaders or module bytes.
They use the generated region map and existing guest-address translation.
The software route has no D3DIM GPU executor. Its actual execute-triangle
trace and bound material/blend snapshots establish the software-side chain;
the WebGL executor records establish the browser submission chain.

## Paired scenes and limits

Both ordinary arms and both diagnostic arms capture three scene frames at
3,000, 4,500 and 6,000 frozen browser slices: 6, 9 and 12 guest seconds.
The explicit frozen tick is 2 ms, matching the registered
`cliTickMsPerBatch: 2` value; browser slices and CLI batches are different
execution units. The browser records a 100,000-block slice setting, with its
normal cooperative deadline. Guest threads are disabled on both routes.
Each arm is capped at 300 seconds and completes before the next starts.

| Arm | Final ExecTri trace records / black alpha-127 records | WebGL draws at the three captures |
| --- | --- | --- |
| Ordinary software | 12,864 / 6,206 | N/A: no GPU executor |
| Ordinary WebGL | 12,930 / 6,420 | 7,581 → 10,034 → 13,539 |
| Diagnostic software | 8,517 / 4,697 | N/A: no GPU executor |
| Diagnostic WebGL | 15,009 / 7,455 | 4,550 → 9,714 → 15,654 |

All 552 successful served-response hashes match the sealed inputs, including
all nine executable/scene/DLL paths listed below on each launch, with no unsealed
successful response. This does not erase the separately logged HTTP failures.
Within the ordinary arms, successive scene-only PNG crops change by
37,268/43,531 pixels on software and 43,395/57,941 on WebGL. The crop excludes
UI and clock; these counts establish motion, not backend parity.

Personally inspected PNGs show gold/green leaves changing position and pose,
with offset dark shadows over the textured leaf backdrop, on both software
and WebGL. The successful browser responses pin identical module and scene
inputs across the arms. Actual local HTTP endpoints, Chrome version,
renderer counters and cleanup are retained per arm. WebGL is Chrome's
WebGL 2 through ANGLE Vulkan SwiftShader, not Node GL or a physical-GPU test.
The owning host enables D3DIM GPU only on the WebGL route; its executor
records zero errors and zero fallbacks.

Scene rendering alone would not prove visual correctness. Together with the
draw evidence, this closes the narrower missing corrected shadow-alpha
validation. It does not establish same-frame pixel parity, native Windows
reference parity, full texture/coverage correctness, a complete saver cycle,
FPS or completion of the historical 27-app corpus. The captures retain
visible edge/texture artifacts and overlapping dark silhouettes; these are
not silently certified. Screensaver input is N/A. Missing optional DLL,
type-library, UI-resource and local account-endpoint messages remain in the
logs; this is not a warning-free-run claim.

## Original inputs actually fetched

Paths below are relative to `test/binaries/`; the browser serves them through
the usual `binaries` alias. The seven executable/scene hashes also match the
retained October 30 `20261030T2222Z-d3drm-scenes/assets.json`. Both archived
October 30 logs were decompressed and checked against `ARCHIVE-RECOVERY.json`.

| Input | SHA-256 |
| --- | --- |
| `screensavers/FALLINGL.SCR` | `470e28bcbc3cf92c514cd8e8bbf9eae399c59f79ed2adbf7bf2b91d25cfb477c` |
| `screensavers/FALLINGL.SCN` | `3a12aa6547c1e4c1dab6a6c3023c0f22f3d0e2845a3983e69f63456748228896` |
| `screensavers/LEAF.X` | `323fa9090f26ab88e0e71b4fe35af06aa7ba53825817f954f7e1a129438bd3f3` |
| `screensavers/LEAF1.GIF` | `8f4b1cc27dfa2c7af7ac81ddf757be12bf569cdfae54f0f8a58ca0bf034e1c27` |
| `screensavers/LEAF2.GIF` | `59e114c726b661d14c1c8e60fec899e9f192c8f6a1fe581d7a1bde822c54dc33` |
| `screensavers/LEAF2.X` | `a87002dea22968dc093c50789fea29b24e1c72d611841ff0127a12306f2c6df2` |
| `screensavers/LEAVES.GIF` | `18bac057ff316699d5ea6502033adda9e5c8825984a9c7c8d32831950893fbd6` |
| `dlls/d3drm.dll` | `fd80f3839a035b6b52362735b22eb8d2523d3434bf18afb3e0f1b5ace84357b0` |
| `dlls/d3dxof.dll` | `1f2d0683668b3039d451d88ed449fd9d49371fab3fadb991636cd6bfb0aa6eee` |

Two additional CRT DLLs were staged and pinned in `assets.json` but were not
fetched by these browser launches; they are not claimed as executed inputs.

## Reproduction and first failure

The retained `original-driver.cjs` is the recovered October 30 browser harness.
`browser.cjs` narrows it to this registered app, the current sealed module,
explicit frozen clock and bounded captures. `diagnostic.cjs` adds the memory
and submission observations described above. In the recovered sealed tree:

```sh
node tools/pe-imports.js test/binaries/screensavers/FALLINGL.SCR --all
node tools/pe-imports.js test/binaries/dlls/d3drm.dll --all
node tools/pe-imports.js test/binaries/dlls/d3dxof.dll --all
node tools/check-wat-manifest.js
flock /tmp/wine-build.lock bash tools/build.sh
node test/test-d3dim-lit-alpha.js
# Run each command to completion before starting the next.
timeout --signal=TERM --kill-after=5s 300s node scratch/runs/20261103-falling-leaves-paired-shadow-alpha/browser.cjs software
timeout --signal=TERM --kill-after=5s 300s node scratch/runs/20261103-falling-leaves-paired-shadow-alpha/browser.cjs webgl
timeout --signal=TERM --kill-after=5s 300s node scratch/runs/20261103-falling-leaves-paired-shadow-alpha/diagnostic.cjs software
timeout --signal=TERM --kill-after=5s 300s node scratch/runs/20261103-falling-leaves-paired-shadow-alpha/diagnostic.cjs webgl
```

All heavy build/test and browser execution occurred on one finite-TTL boat,
`bx_xb4h5hmk`, original expiry `2026-11-03T17:39:19.176Z`. Its identity, expiry
and original-task delegated normal shutdown were recorded before use.

The first full build failed because this worker's source staging filter
omitted the two committed `docs/dos-corpus/live/toyvm-*-bundle.js` files.
`first-build.log`, `first-build.exit` and `build-command.json` preserve that
failure and exact invocation. Adding those pinned committed files fixed the
staging omission; the same locked build passed without a budget increase.
No production defect was established. The first observational selector also
expected exact alpha 128 and therefore counted no original-scene shadows;
its records are retained. The diagnostic runs account for actual alpha 127
without changing render inputs or execution budgets.

`RECOVERY.json`, `recovery-download.json`, the recovery archive and full SHA
manifests retain replay commands, source, assets, tested modules, logs, frame
state and PNGs. Recovery is verified before the delegated normal STOP.
Final lifecycle receipts and publication details are retained in the run.
The 56,690,344-byte recovery archive has SHA-256
`9b0c0cf3256f04858702350047dad1319532c2d139f59b04deee186b2d7c0a8b`;
all 122 payload files and 5,842 source/input members were retrieved and hash
verified before STOP. The boat reached STOPPED at `2026-11-03T16:25:18.415Z`,
stop operation `stop_2aa02dfb5503861b` completed with `error: null` and
`forced: false`. Snapshot `cf344642-29b8-4b43-a6c6-c6aa73d4fc87` is completed,
available and verified at `2026-11-03T16:25:17.988Z`. All four browser PIDs and
profiles are absent, all four local HTTP ports are closed, and owned runtime
helpers are absent. Snapshot custody returns to the coordinator; this worker
has no successor task.
