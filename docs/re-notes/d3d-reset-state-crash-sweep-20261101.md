# Reset, state retention and complex surface crash sweep, 2026-11-01

Five of six requested native fixtures passed; typed stateblocks stopped at an
ordinary assertion because its allocation-failure injection is bypassed by the
current render compiler isolation. No native crash, uncaught Wasm trap, signal
or timeout was observed. Assertions and production code were left unchanged.
Evidence: `scratch/runs/20261101-d3d-reset-state-crash-sweep/` (ignored).

Baseline: `ed429467d3ed2b62dcce1305cea7fb8d7704e3fb`. All six tests ran on main
`b3a0f407119ce5239209475f973eb2673809c4f6`, tree
`cd14946c974f162b4807fec3cc762caa62f9d5b7`. The only committed advancement
was `TODOS.md` and `ops/STATUS.md`, allowed by the assignment after verifying
source identity. All 1,243 tracked inventory entries matched the baseline;
all 1,247 inventoried inputs remained byte-identical before/after execution.
The inventory covers source, compiler, host/helper/test inputs, existing build,
and bundled fonts/package manifests. Existing foreign WIP was not edited.

| Fixture under `test/` | Exit / seconds | Actual coverage |
| --- | --- | --- |
| `test-d3d8-reset-handles.js` | 0 / 3.868 | Direct software and Worker: failed reset preserves program/handles; two successful resets per backend clear bindings while retaining live shader handles and bytecode, rejecting deleted handles, and preserving monotonic handle allocation; device destruction reclaims vertex resource spans. |
| `test-d3d9-reset-presentation.js` | 0 / 3.979 | Direct software and Worker: backend failure preserves target/program/565 format; packed-format transitions, fullscreen 16bpp creation, display-boundary waiting, invalid presentation rejection without state/host resize, successful material/light/scissor/texture/sampler reset, deferred fullscreen resize, desktop restoration and final texture/pixel heap retirement. The source's old “KNOWN FAILING” exact light free-list assertion also passed in this run. |
| `test-d3d9-stateblocks.js` | 0 / 3.789 | Selective recording leaves live state intact; last writes win; copied transforms/constants survive caller-memory reuse; Capture/Apply preserve unrecorded state; buffers, appended texture stages, declarations/FVF and shaders retain/release references correctly; gamma copy/defaults and N-patch rejection checks pass. |
| `test-d3d9-typed-stateblocks.js` | 1 / 3.419 | ALL/PIXEL/VERTEX membership, shader constant banks, material/matrices, texture references, FVF, viewport/scissor, device reference balance for completed blocks, and frozen light membership pass before the first OOM assertion. The injected allocation-failure contract is not exercised successfully; details below. |
| `test-d3d9-viewport-stateblock.js` | 0 / 3.374 | Viewport/scissor recording isolation, copied last-valid values, bounds/invalid pointers, Capture/Apply, empty blocks and rejection during recording. |
| `test-ddraw-complex-surface-release.js` | 0 / 3.426 | Surface interface lifetime, implicit/held backbuffer and mip attachment release; double/triple/four-buffer rotations with distinct storage, pixels and stable role caps; invalid flips preserve associations; intermediate-member retention, stale-front rejection, object-slot/video-arena failure rollback, reuse and full video-memory refunds. Also runs its existing six-size GetCaps buffer guards. |

## Typed stateblock fixture limitation

At `test/test-d3d9-typed-stateblocks.js:145`, the first `fail=0` iteration
expected `0x8007000e` (`E_OUTOFMEMORY`, decimal 2147942414), but
`CreateStateBlock(ALL)` returned 0. The process printed `AssertionError
[ERR_ASSERTION]` and exited 1. This is not a native trap or proof of a
production OOM rollback failure.

The fixture patches the shared `require('./compile-src').compileSrcWasm`
export at lines 4–9 to replace resource allocation/free calls with its
`$test_alloc`/`$test_free` wrappers. Inspection of the executed current
`test/render-artifact.js:107–168` establishes that `compileSnapshot` evaluates
a separate, sealed CommonJS compiler graph with its own cache and loads
`test/compile-src.js` there. Its only supplied source transform appends
`extraWat` to `13-exports.wat`. Consequently the shared-export monkey-patch
does not reach the compilation; the appended `fail` export exists but does not
intercept production allocations. The observed successful creation is
consistent with that disconnected injection. Relevant source excerpts and
the unchanged instantiated module are preserved in the run directory.

The preceding counter reaches 71 cases by source control flow, but the test
never prints its final PASS. The first failure prevents all four OOM cases'
rollback/retry assertions, subsequent invalid type/output and active-recording
checks, and final device/buffer cleanup from completing. These paths remain
unvalidated here. No assertion was relaxed and no diagnostic rerun was added.
Next work would be a separately scoped repair of fixture injection through
the current compiler boundary, retaining its existing assertions, followed by
the complete typed-stateblock test. This assignment makes no such repair.

## Commands and module identity

The six fixtures were inspected first and executed once, sequentially in the
table order, each with the exact command shape:

```sh
SWEEP_CAPTURE_PREFIX=/home/user/wine-assembly/scratch/runs/20261101-d3d-reset-state-crash-sweep/<fixture-stem> timeout 120s node --require /home/user/wine-assembly/scratch/runs/20261101-d3d-reset-state-crash-sweep/capture-module.cjs test/<fixture-stem>.js
```

`outcomes.json` records the full argument arrays, HEAD, duration and exit for
each command. `run.py` reproduces that order and stops on a native crash/trap;
it checks baseline-compatible HEAD, input identity and free disk above 2 GB.
The evidence-only preload forwards original WebAssembly arguments unchanged,
hashes/saves module bytes, and records loaded CommonJS files. It does not
modify assertions, imports or compiler options. Worker paths receive the
parent's compiled module; no separate Worker byte compilation is claimed.

| Fixture suffix | Module bytes | Instantiated module SHA-256 |
| --- | ---: | --- |
| d3d8-reset-handles | 2025328 | `8334700d7988612758861a09f2e05c613dfd12be3f6e61e579dedf180b242cd5` |
| d3d9-reset-presentation | 2025666 | `3b1e07b8c72bffab8361d541c89e188e59d224e9088a71e99a98e6086ab582a0` |
| d3d9-stateblocks | 2027358 | `8dcc5c124117ae8a5d13589e13eab1d38fd0504aec2427dbf7c087cd812f8ecb` |
| d3d9-typed-stateblocks | 2028096 | `0004a4f7bbb9c1425ef0240e7dcf54e8878d0b8742b1b45fa219bacb95330e51` |
| d3d9-viewport-stateblock | 2025539 | `bfaa51a21007e88d5bd1fcb75db97a7e97e06e0ce98dd47c724dbd0150aed601` |
| ddraw-complex-surface-release | 2025766 | `ace17bf48bf8da4de9cdd28886393e4fe2727d3ba6054d0ff084c0d60e92f2c3` |

These harnesses compile the current canonical WATX closure with their existing
test exports and tail calls enabled. Linux x86_64 Node 24.18.1 / V8
13.6.233.17-node.50 used default engine tiering, without NODE_OPTIONS or WINE
overrides. Native/software paths use 512 MiB shared Wasm memory and the
repository's JavaScript raster canvas. The complex-surface fixture's default
bundled fonts were present; the other five request `fonts: 'none'`.
No missing dependencies or stale primary build were found. Of 71 unique
parent-process CommonJS modules recorded, 49 tracked repository files match
the baseline; 22 installed dependencies match their recorded exit-time bytes.
Private compiler inputs are covered separately by the source inventory.

All 1,169 inputs from the accepted preceding run
`20261101-legacy-filter-assertions/inputs-after.json` match unchanged. Reused
build evidence is that run's `timeout 120s flock /tmp/wine-build.lock bash
tools/build.sh`, exit 0 in 44.589 seconds. The current primary build is
2,025,029 bytes, SHA-256
`2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`,
matching its accepted identity. No redundant full build or earlier lifetime,
caps or crash sweep was run. This documentation-only change uses
`git diff --check`; no new full-build pass is claimed.

Logs, six original modules, input inventories, environment, module records,
loaded-module verification, source excerpts and result/publication records
remain ignored. No artifacts enter Git. Free disk remained above 2 GB
(2,472,366,080 bytes after the tests). No browser, benchmark, game, download,
access retry, REP test/diagnostic, held-work change, worker launch or public
deployment occurred. Box ID/state/expiry and lifecycle ownership: N/A; no
box was assigned or accessed. These findings do not establish gameplay,
full-suite coverage or absence of crashes across applications. The worker
stops after this single assignment.
