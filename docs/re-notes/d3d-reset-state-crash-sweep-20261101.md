# Reset, state retention and complex surface crash sweep, 2026-11-01

Follow-up: the fixture-only repair below completes all 81 typed-stateblock
cases, including four proven allocation failures. The original sweep findings
and module identities remain recorded here as historical evidence.

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

## Typed allocation-injection repair, 2026-11-01

Run `scratch/runs/20261101-d3d-typed-stateblock-injection/` repairs only
`test/test-d3d9-typed-stateblocks.js`. It follows the explicit transformed
`compileSrcWasm` pattern in `test-d3d9-shader-retention-oom.js` and the existing
`bootRenderHarness({prebuiltModule})` interface. It removes the ineffective
shared-export monkeypatch, compiles the resource transform and appended test
exports together, constructs a `WebAssembly.Module`, and supplies that module
explicitly. It rejects canonical render-artifact prepare/consume environment
modes before compiling, so a transformed fixture cannot masquerade as an
ordinary artifact. Production, helper, compiler and artifact identity/isolation
checks are unchanged.

The original resource-wide allocation/free replacement remains fixture-only.
The transform now asserts exactly one resource fragment and one export
fragment, with seven allocation and four free call sites. Counters reset for
each fault and prove the actual allocation sequence:

| Selected failure | Allocation attempts | Rejected calls | Rejected size | HRESULT |
| --- | ---: | ---: | ---: | --- |
| 0: block | 1 | 1 | 25892 | `8007000e` |
| 1: first light copy | 2 | 1 | 120 | `8007000e` |
| 2: second light copy | 3 | 1 | 120 | `8007000e` |
| 3: third light copy | 4 | 1 | 120 | `8007000e` |

Every original membership, refcount, output-clear, allocation-reclamation,
device-state rollback, successful retry, invalid type/output, recording and
final cleanup assertion is preserved. The full fixture prints
`PASS typed CreateStateBlock 81 cases`. No production defect was exposed.

The explicit `--without-allocation-injection` negative control compiles the
same source closure and test exports without changing any resource allocation
or free calls. It reaches the same first OOM expectation after the membership
cases, reports zero wrapper attempts/failures and HRESULT 0, then exits 1 at
`injected CreateStateBlock must return E_OUTOFMEMORY`. The evidence runner
requires that exact assertion, successful creation and zero injection calls;
an arbitrary nonzero exit does not count as a successful control.

Commands ran sequentially, each under `timeout 120s`: `node
test/test-d3d9-typed-stateblocks.js`, the same command with
`--without-allocation-injection`, `node test/test-d3d9-shader-retention-oom.js`,
`node test/test-render-artifact-protocol.js`, then
`flock /tmp/wine-build.lock bash tools/build.sh`. The ignored `run.py` records
exact argument arrays, expected exits, durations and tested HEAD in
`outcomes.json`. Its evidence-only preload forwards original module bytes and
transform results unchanged, capturing both original/transformed WAT and
instantiated module identities. The protocol test covers canonical artifact
identity, sealed compiler isolation and the prebuilt-module overload; its tiny
compiler/host doubles are not native-renderer coverage. None of the five
accepted independent sweep fixtures was rerun.

| Validation | Exit / seconds | Result |
| --- | --- | --- |
| Full typed fixture | 0 / 3.309 | All 81 cases pass; four observed OOM fail points. |
| No-injection control | 1 / 3.330 | Expected rejection of the OOM assertion, actual HRESULT 0. |
| Retained-shader OOM fixture | 0 / 3.491 | Rollback, reference balance, temporary reclamation and retry pass. |
| Render artifact protocol | 0 / 0.219 | 34 protocol checks and 10 executable cache controls pass. |
| Mandatory locked build | 0 / 46.479 | All build gates pass; primary Wasm hash unchanged. |

Both typed modules are 2,028,209 bytes. Injected SHA-256:
`e3aa7342454d2b5cbc82fe80236cdecda0f402d3eeb5651c51f03de7182b43f4`;
no-injection SHA-256:
`8e92dc5caa5de4d2f63437b4f1be164b9fcca9e8b91403d243bd11decf449b27`.
Both use the identical appended export fragment. Exact source/module/transform
hashes and bytes are retained in ignored evidence, not Git. Baseline
`e846dc234f6686b7f2d90617ab0e07fe92582b9d` matches all 4,462 tracked source,
compiler, test, host, font and package inputs before the correction. Tested
HEAD `18507c0efac6a147b56dfb94d77ae39f8ba1cd4a` advances only `TODOS.md`
and `ops/STATUS.md`, as allowed after the source-identity check. Node/V8,
default engine tiering, software backend, fonts disabled and 512 MiB shared
memory are as in the original sweep. No native crash, trap, signal, timeout,
box use or lifecycle action occurred; box ID/state/expiry are N/A.

Post-run inventory changes only the owned typed test among those 4,462 inputs.
All 67 loaded repository/dependency modules match recorded execution bytes;
44 unchanged tracked loaded modules also match the baseline, alongside the
owned changed test and 22 installed dependencies. The primary build remains
SHA-256 `2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`.
Free disk after validation is 2,457,694,208 bytes, above the 2 GB assignment
floor. No production/helper/compiler/census/held-work or foreign-WIP edits
were made. Next action is coordinator review of this single completed repair.
