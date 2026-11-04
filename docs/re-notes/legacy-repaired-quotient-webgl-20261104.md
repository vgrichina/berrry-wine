# Repaired quotient-gradient projected WebGL matrix

All sixteen positive WebGL cells pass with the repaired analytic projected mip
atlas. The fault matrix stopped at a demonstrated captured-matrix runner scope
bug, now repaired and tested offline. The complete fault matrix remains
unqualified. PROJECTED remains unadvertised. Generated coordinates, other input dimensions, full27 and physical
hardware remain unqualified.

Read with [the first actual mip failure and offline repair](legacy-provisioned-count-webgl-20261104.md),
[the expanded supplied-coordinate contract](legacy-projected-coordinate-contract-20261104.md)
and [the historical COUNT3 matrix](legacy-queued-projected-completion-20261104.md).
The historical fixture is not evidence for the expanded matrix.

Evidence is retained in `scratch/runs/20261104-legacy-repaired-quotient-webgl/`.
The exact source revision, relevant binary diff and path/hash pins are in
`git-sha.txt`, `relevant-before.diff` and `source-seal.json`. Git is the source
archive. Only changed small backend/shader/runner dependencies were staged;
retained media and module paths are referenced by full SHA-256. Both runtime
modules already matched the authorized hashes under the build lock, so no
module/media copy was necessary. The locked full build reproduced both hashes.

The runner reuses the exported `fixtureSource`, `plan` and independent rational
oracle from `test/test-legacy-projected-coordinate-contract.js`, through the
existing real browser harness. Tolerance remains two bytes. All three counts,
selectors 0/1/2/7, independent geometric W and texture q, analytic mip levels
1–4, near clipping, held selector/matrix/flags mutation and six semantic fault
controls remain. Recording/compiler submissions are separate from GL pixels.
The runner now identifies the published repair commit and requires an explicit
hard-close environment value instead of a stale historical default.

## Actual rendered results

One Chrome 151.0.7922.108 process ran on assigned `bx_a9w3p8hk` from
**08:42:16.986Z to 08:49:23.629Z**, then closed normally at the first unexpected
failure. The explicit hard close was 09:10Z. No second browser or retry ran.
Tested source is `cfad0fbee91fb0c921d0f72ca0a7832a5890c052`, including the
runner/other relevant working hunks in `relevant-before.diff`. It includes the
published production quotient repair from `a62801c2f653b738a9ba6fa052c91b9d7c673d52`.

| Module | Route | Cells | Public draws per cell | Pixel observations per cell |
| --- | --- | ---: | ---: | ---: |
| Normal | Direct GL | 4 | 155 | 465 |
| Normal | Owning Worker GL | 4 | 309 | 866 |
| Compat | Direct GL | 4 | 155 | 465 |
| Compat | Owning Worker GL | 4 | 309 | 866 |

Each group covers WebGL1/WebGL2 × public direct/indexed Draw. All **3,712 public
Draws and 10,648 positive observations pass**, including 72 clipped-away Clear
samples and 616 held pairs. Each held pair captures the old draw, mutates live
selector/matrix/flags through COM before delivery, then checks the old pixels
and subsequently rendered new state. Public Surface7 Lock supplies asserted
RGB; direct routes also agree exactly with independent GL readPixels. Worker
observations require the actual legacy GL endpoint and zero errors, fallback,
native-software or fallback-software draw completions. PROJECTED stays clear
in public descriptors throughout.

The previously failing COUNT3/TEX7/scale16/wfalse sample (9,11) now reads
**138,87,119 in all sixteen cells**, exactly matching the independent oracle.
The former result was 137,163,146. No further production rendering defect was
demonstrated in this run.

## First failure and repair

The canonical nonindexed WebGL1 COUNT2 faults for ignored projection, wrong
selector, wrong divisor, early division and suppressed LOD each reach a
successful public Draw and a rendered PIXEL ORACLE rejection. The first four
read 60,25,65 versus expected 20,25,30; suppressed LOD reads 60,25,65 versus
59,56,57. These are deliberate semantic injections, not production defects.

The sixth fault, COUNT2/WebGL1 owning-Worker captured-matrix replacement,
failed with **`ReferenceError: identity is not defined`**. The delayed delivery
callback was outside the scope containing the public setup's `identity`
constant. It therefore failed before the intended corrupted-record pixel
rejection. Its earlier uncorrupted draws are not counted as successful fault
coverage. All thirty later fault variants were unexecuted; this repaired
variant plus those thirty still need actual rendered qualification. The
positive matrix remains valid independently of this test-only fault failure.

`test/test-legacy-count-selector-webgl.js` now injects a self-contained
`corruptCapturedMatrices` helper with a local identity literal. Its regression
runs the exact helper in an isolated realm with no `identity` binding, on
framed type-3 and type-4 records, and executes the exact emitted postMessage
wrapper through held then drained delivery. Reintroducing the old scope
reference in memory makes that regression fail with the original ReferenceError.
Only the type-4 owned matrix changes; adjacent
record bytes and guards remain exact, and invalid framing rejects. The emitted
fixture parses, analytic plan/repair controls pass, and both predecessor
production files still fail the quotient regressions. This is an **offline
runner repair**, not a successful GL captured-matrix fault. No production file
was changed in this task. `relevant-final.diff` separates the post-closure
repair from the exact browser-tested source.

## Validation, recovery and custody

Separate `--preflight` passed before Chrome: actual Puppeteer 24.31.0 CJS/ESM
imports and retained dependency lock, all 44 source/module/media pins, served
HTTP hashes/isolation, both exact modules' public COM bootstrap and production
recording transport. Browser cache graph checks pass: 98 page / 13 Worker
scripts. The retained calc path is `test/binaries/calc.exe`, SHA-256
`cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b`.

| Retained runtime module | SHA-256 |
| --- | --- |
| build/wine-assembly.wasm | 129a71a01a5fbc8b07d6fa242a5a3ebc6a29f5aed9fb4b6a47d9318a764c1f52 |
| build/wine-assembly.compat.wasm | 3fde0fc42ecd0d9d5096d0b9eb83cd3086cb74aab8ac3f7b9f3fd15f5783fe6a |

Both full expanded native software suites pass: four routes with 155 draws /
465 observations per route, actual held native Worker replay, all eighteen
rendered fault rejections per module, and separate unqualified generated
characterizations. Both public caps suites pass 47 calls / 55 descriptors.
Shader, fixed-function shaders, fixed plan cache, depthless-Z, batching,
fallback counters and solid transport plan checks pass. The locked full build
passes both before Chrome and after the runner repair. No recording submission
or software result is counted as GL pixels.

`remote-artifacts.json` / `recover.log` verify all five closed remote artifacts
by full SHA-256 and size. `result.json.gz` losslessly recovers 192,034,623 bytes,
original SHA-256
`da6582bac3cddcde051165dbc46c28f2f3c9a6ce825d39e7509f403cec0f890f`.
The local audit checks every positive RGB against unchanged tolerance and its
32×32 Lock array, direct GL readback, Worker exclusion counters, all five
completed rendered negative controls and the exact first unexpected failure.
Three queued COUNT2/3/4 readback PNGs were encoded from retained Lock arrays
and personally inspected. No source tree archive, repeated media or duplicate
module recovery was made. The global evidence checker reports existing errors;
none names this run.

After closure, all 44 remote pins match, Chrome is absent and the fixture
server is closed. The runtime retains the exact browser-tested source; the
post-closure runner repair is local and published with its diff. Box inspection
confirms healthy/hydrated **RUNNING / API idle**, expiry
**2026-11-04T09:20:14.588Z**. Shutdown ownership returns to the coordinator.
No allocation, resume, stop, source-box access, local browser, subworker,
successor, game, Heroes II or deployment was used.

CDP reports ANGLE/Vulkan SwiftShader; context unmasked strings report Intel/Mesa.
Their conflicting identity does not qualify physical hardware. Generated
coordinates, other input dimensions, full27 and hardware remain unqualified.
Next is a separately authorized run of the repaired captured-matrix control
and remaining semantic variants, with refreshed source pins/preflight.

