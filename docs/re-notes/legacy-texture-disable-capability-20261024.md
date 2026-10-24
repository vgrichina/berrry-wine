# Legacy DISABLE capability reconciliation — 2026-10-24

Exact baseline: current authenticated remote main
`e5f45399bc5564a84b6b1428e15ffa412db9e929`. The independently accepted
stage-zero DISABLE implementation is already present; this change only reconciles
its advertised capability. `d3dim_fill_device_desc7` wrote `0xE` at byte 180,
omitting DISABLE. It now writes `0xF`: DISABLE, SELECTARG1, SELECTARG2, MODULATE.
Both blend-stage and simultaneous-texture limits remain one.

Microsoft's legacy [D3DHAL_D3DEXTENDEDCAPS contract](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dhal/ns-d3dhal-_d3dhal_d3dextendedcaps)
defines `dwTextureOpCaps` as supported operations and explicitly associates
`D3DTEXOPCAPS_DISABLE` with supported `D3DTOP_DISABLE`. The
[operation contract](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dtextureop)
defines DISABLE=1 and stage-zero termination. These support advertising the
already implemented diffuse-RGBA termination, without adding any operation.

`test/test-legacy-texture-disable-capability.js` compiles the authentic capability
writer and software excerpts through the existing one-page fixture. It checks
the supported-operation bits independently, excludes every other bit, preserves
descriptor sentinels and one-stage limits, exercises disabled RGBA and both
software routes across four alpha operations, and runs the existing independent
SELECTARG1/2/MODULATE pixel oracle. Exact baseline fails with
`missing supported operation 1`; candidate passes. Six overclaim controls add
operation bits 5, 6, 7, 10, 26 and 32; all reject specifically on unsupported
advertisement. A seventh control removes DISABLE's early combiner termination
while retaining its advertised bit; it rejects on the diffuse-RGBA assertion.
Compiler/setup failures cannot satisfy those rejecting controls.

Only the nearby caps fixture's obsolete mask expectation and its three mask
mutations change: missing DISABLE, added MODULATE2X and missing MODULATE remain
rejecting cases. The direct suite passes nine operation pairs, 144 argument
combinations, six remaining unsupported-operation diagnostics and 15 controls.
The accepted unchanged DISABLE suite passes eight bound/unbound-alpha cases,
re-enable/binding preservation and three independent semantic reversions.
Unchanged GPU batching and points suites pass. Automatic unit-tier classification
of the new filename passes; a whole-repository manifest/build was not run.

Exact commands, executed from the private checkout with installed Node:

```sh
node --max-old-space-size=256 test/test-legacy-texture-disable-capability.js --manifest-only
node --max-old-space-size=256 test/test-legacy-texture-disable-capability.js
node --max-old-space-size=256 test/test-legacy-texture-disable.js
node --max-old-space-size=256 test/test-legacy-texture-operation-caps.js --negative-controls
node --max-old-space-size=256 test/test-d3dim-gpu-batching.js
node --max-old-space-size=256 test/test-d3dim-gpu-points.js
```

Each invocation has 60-second wall/CPU guards and checks MemAvailable >=805306368.
The precompilation manifests bind full compiler Git blobs/SHA-256 in
`closure-manifest.json` to exact byte offsets, excerpt order and hashes in
`baseline-manifest-caps.json` / `candidate-manifest-caps.json`.
Qualification is authentic small Wasm excerpts/software fixture pixels and mocked
GPU lowering. No full canonical compile, COM/native guest, GPU pixels, browser,
gameplay, modifiers or multistage qualification is added. Unsupported-operation
fallback diagnostics and existing fail-fast paths are unchanged.

Retained evidence: `/tmp/legacy-texture-disable-capability-oct24/`, including
`runs.jsonl`, uniquely named logs, compiler/excerpt receipts, resource receipts,
`closure.json` and final seals/publication receipt. Recovery: create an isolated
explicit sparse checkout at the baseline, restore this task's test/fixture, run
the contract against baseline source (expected exit 1), then against this task's
source (expected exit 0), followed by the commands above. Existing immutable
donors and installed tools are standing inputs; they were not copied invisibly.
Initial instruction display overflow is retained and conservatively charged;
an initial misplaced `--manifest-only` Node option exited 9 before compilation,
then the corrected argument order passed. Neither is a resource denial. All
history and charges are retained. Root tracked files/index/refs and donors are
untouched; the append-only root board is the coordination exception.

Task branch only, pending independent review and coordinator integration.
No box assigned (ID/state/expiry N/A); coordinator retains lifecycle ownership.
