# Bounded native D3D draw/buffer sweep — 2026-11-01

All three original fixtures passed sequentially, each under `timeout 120s`.
No unexpected native crash, unhandled trap, assertion failure, signal or timeout
occurred. Expected refusals and cancellation assertions passed. No repair is
indicated by this sweep. Source, tests and assertions were unchanged.

Evidence run: `scratch/runs/20261101-d3d-draw-buffer-crash-sweep/` (ignored).
Baseline: `4205d014100b9566c6ec88164c4374af385ba544`; tested HEAD:
`65339d74dd1c695e256fdb2e925290bd24f0ede1`. The only committed differences
from baseline at execution were `TODOS.md` and `ops/STATUS.md`; relevant
working source/test inputs also matched baseline. Foreign WIP was not edited.

## Terminal results and reproduction

From `/home/user/wine-assembly`, the actual command for each row was:

```sh
SWEEP_CASE_DIR="$PWD/scratch/runs/20261101-d3d-draw-buffer-crash-sweep/CASE" \
  timeout 120s node \
  --require "$PWD/scratch/runs/20261101-d3d-draw-buffer-crash-sweep/observe.cjs" \
  test/CASE.js
```

Replace `CASE` with the fixture basename below. `run.py` retains the exact
argv, sequential runner and environment handling: artifact prepare/consume
variables were removed; no optional stress/no-coalesce arguments were used.
Each case directory retains real `stdout.log`, `stderr.log`, `exit.json`,
`node-exit.json`, `loaded.json`, `modules.jsonl` and actual `module-1.wasm`.
All fixture stderr logs were empty.

| CASE | Exit | Initial seconds | Final seconds |
| --- | ---: | ---: | ---: |
| test-d3d9-nan-vertex | 0 | 8.547 | 4.897 |
| test-d3d9-large-draw | 0 | 7.158 | 6.168 |
| test-d3d9-buffers | 0 | 5.168 | 6.662 |

The initial pass is retained under `initial-pass/`. Its observer captured source
reads and instantiated Wasm but omitted explicit native-addon loading. The
same three fixtures were repeated in the same order solely to close that
identity gap, with `process.dlopen` observation added. No addons loaded:
`lib/canvas-compat.js` uses `lib/raster-canvas.js` and pngjs. Both passes
produced identical per-fixture Wasm hashes. The observer records reads/bytes
and delegates original calls; it does not change fixture assertions, exports,
draw inputs, compiler transforms, return values or scheduling.

## Assertion coverage and expected outcomes

* **Non-finite vertices:** real compiled software rasterizer, 32×32 target,
  shader-driven two-triangle control covering both halves. A NaN vertex in
  either triangle culls that triangle while preserving the other triangle's
  exact coverage; Infinity also culls its triangle without failing the draw.
  A subsequent ordinary draw exactly restores control coverage. Device
  destruction leaves zero owned bytes. Non-finite vertices are successful
  draws with local culling, not expected whole-draw refusals. The fixture's
  historical game reference is commentary; its inputs here are synthetic.
* **Large draws:** 2,950 triangles, multiple native contexts, all 8,850 indices
  processed, exactly two shader compilations, one shared texture copy and a
  bind per context. Native samples total `2950 * 36 = 106200`; ordered final
  green pixels and alpha-blended destination contents survive batch boundaries.
  Forced failure at the third new context must throw
  `/native raster validation rejected/`; a 2 MiB device budget must throw
  `/budget exceeded/`. Both preserve prior sample counts and pixels, release
  all tracked contexts and return owned bytes to baseline. These are intentional
  checked refusals, not unexpected failures. Thirty-two repeated mipmapped
  draws check native allocation reuse after warm-up. Async tests mutate caller
  arrays after submission, reject readback/count access while in flight,
  advance until exactly one batch has stepped, cancel and require `/cancel/`
  rejection with no partial published sample count or future batch execution.
  A second async draw completes all batches exactly once with preserved
  snapshot pixels and cleanup. Scheduling is a test-controlled callback queue,
  not a real render-worker transport or timing stress.
* **Buffers:** compiled native D3D9 COM handlers via original extra-WAT exports.
  Vertex/index buffers share a resource vtable; descriptor contents and trailing
  sentinels are checked, including absence of an index-buffer FVF field.
  Lock size zero, pointer arithmetic and data retention are checked. Nested
  locks, double unlock, end overflow, READONLY on WRITEONLY, DISCARD without
  dynamic usage, managed/dynamic creation, cross-device binding, wrong kind
  and out-of-range stream offset must return `0x8876086c`. Invalid creation
  clears the output pointer. Internal binding retains allocation after external
  Release; QueryInterface succeeds for the vertex buffer IID, returns
  `0x80004002` and clears output for the index buffer; unbind/release paths run.
  `GetDevice` is exported by the fixture but never called, so it is not claimed
  as covered. This test does not prove global heap reclamation or every COM IID.

All original assertions reached their terminal PASS messages in both passes;
no assertions were removed, bypassed or weakened. Expected errors are caught
and checked inside the original fixtures. No expected native traps or signals
are present in these three fixture bodies.

## Source, build and module identities

The accepted locked build in
`scratch/runs/20261101-d3dim-worker-fallback-repair/` was reused for build-gate
acceptance only after its `build.exit` (0), successful `build.log`, artifact
hash and all 4,462 entries in `inputs-current.json` were checked. They matched
before execution and after both passes. No accepted unrelated tests or full
build were rerun. The original render harness independently compiles its
canonical sealed source closure, with its original extra-WAT exports; it does
not directly load the shipped binary.

Canonical `build/wine-assembly.wasm` SHA-256:
`2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`.

| Actual instantiated module | Bytes | SHA-256 |
| --- | ---: | --- |
| nan-vertex | 2024992 | `ac9beb2ae3f746c621d0f258d4d3a2d1910207b0006e13ed96856bd0ac4975d9` |
| large-draw | 2025040 | `3411a3be9b3fde59d56df5b320679dac9d3a50ba55efbe5fbff27d7623360a16` |
| buffers | 2025391 | `51803505751242c94dee2cbf0adfc6500d0919197d5aaf963e82363d0a245986` |

The nan-vertex module has all nine non-custom sections identical to the
canonical artifact; its 37-byte difference is the build's custom stamp.
Large-draw and buffers differ in sections 3/7/10 (function declarations,
exports and code) because of their original extra-WAT test accessors; other
non-custom sections match. Full section hashes and exact module bytes remain
in the run, rather than treating the canonical hash as their identity.

`verification.json` records 64 distinct read-file identities: 42 tracked files
match baseline and current bytes, and 22 installed pngjs files match their
captured hashes (not Git-tracked). The sealed source/compiler inventory is
retained as `inputs-before.json`; `accepted-build-input-check.json`, both
per-case read manifests and `verification-summary.json` retain the checks.
Node `v24.18.1`, Linux x86-64, full Node versions/argv and environment identity
are retained. The observer covers repository file reads and addon loads;
Node builtins and operating-system shared libraries are identified by runtime
version/environment, not independently traced byte inventories. No external
downloads or access retries were needed.

## Limits and disposition

This is bounded synthetic native software-rasterizer and buffer-handler
coverage. It does not establish gameplay, Black & White 2 compatibility, held
guest/replay behavior, real GPU behavior, browser behavior, worker transport
stress, or general crash freedom. No held game, REP test/diagnostic, unrelated
fixture, heavy benchmark, box, worker/successor or deployment was used.

No failure reproduction or separately scoped repair is needed: every original
fixture has a successful terminal result. Next action is coordinator review of
these findings only; this single assignment stops after publication. Evidence
remains ignored; only this document is committed. Free disk remained above
2,000,000,000 bytes (final verification approximately 2.36 GB). Box ID, state,
expiry and lifecycle are N/A; no box ownership was acquired or changed.
