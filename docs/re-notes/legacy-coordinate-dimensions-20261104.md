# Supplied FVF coordinate dimensions: bounded audit and packing repair

The new audit demonstrates a production FVF layout defect and repairs it.
Immediate Device7 draws now decode mixed FLOAT1/2/3/4 texture-set layouts,
including selector offsets and the FLOAT1 missing-v default. Eight new normal
module WebGL cells pass. The sole browser run was terminated by an incorrectly
short launcher timeout after those positives; **new WebGL negative controls
remain unexecuted**. Their software pixel controls pass. No second Chrome,
reload or continuation of the browser audit was attempted.

The qualified boundary is deliberately limited:

| Supplied input | Qualified immediate DrawPrimitive7 / DrawIndexedPrimitive7 behavior |
| --- | --- |
| FLOAT1 | Disabled transform samples `(u,0)`; projected COUNT2/3/4 transforms `(u,0,0,1)` |
| FLOAT2 | Disabled transform samples `(u,v)`; projected COUNT2/3/4 transforms `(u,v,0,1)` |
| FLOAT3/4 | Disabled transform samples the first two supplied components, ignoring extra components for this 2D sampler |
| FLOAT3/4 with enabled texture transform | Explicit `0x80070057` rejection; extra input components cannot be preserved by the current canonical record |
| Supplied selector outside a nonempty FVF's declared sets, or more than eight sets | Explicit `0x80070057` rejection |

This is not full transformed FLOAT3/4 support. Ordinary nonprojected COUNT
transforms, projected singular divisors, dimensional VB/strided/ProcessVertices
rendering, generated coordinates, full27, physical hardware and gameplay remain
unqualified. PROJECTED is still unadvertised. No capability was widened.

## Existing contract and demonstrated defect

Read with [the accepted matrix/fault audit](legacy-captured-matrix-faults-20261104.md).
Its expanded native fixture used FVF `0x8e2`, with eight FLOAT2 sets and no
TEXCOORDSIZE bits. It did not exercise dimensional FVF layouts. The accepted
sixteen-cell browser matrix and 36 semantic controls were not rerun in Chrome.

Production `fill_primcaps` advertises texture caps `0xF3DF` with PROJECTED
`0x400` clear. Device7's public `dwFVFCaps` is eight texture sets; every new
cell's captured GetCaps confirms it. The count selects an output dimension,
while TEXCOORDINDEX selects a supplied set. Neither changes the storage layout
specified by the FVF. The D3D7 TEXCOORDSIZE encoding is FLOAT2/3/4/1 = 0/1/2/3
in successive two-bit fields beginning at bit 16.

The old `d3dim_fvf_stride` always added eight bytes per set. All three general
packing branches also skipped eight bytes per preceding set and unconditionally
read a second float. On the retained old normal module, the new first FLOAT1
public Draw returned success, but sample `(5,5)` remained Clear `[11,22,33]`
instead of `[20,25,30]`. `predecessor-exec.json` preserves the actual-WASM
failure before the old module was replaced. This was a real pixel mismatch,
not a parser or setup exception.

The repair sums each encoded dimension for stride and selector offset. FLOAT1
packing leaves the zero-initialized second component intact. The exact
FLOAT2-only MW3 fast path remains valid. Device7 immediate handlers reject
unsupported transformed FLOAT3/4 and invalid supplied set/count boundaries
before packing, with the correct stdcall stack cleanup. Existing other methods
are not included in this new validation claim. The shared stride change also
affects VB allocation; existing VB capacity, packing/unpacking, alias, lifetime
and stack regressions pass, but dimensional VB rendering is not qualified.

## New pixels and controls

`test/test-legacy-coordinate-dimensions.js` authors 92 new states with mixed
layouts `12341342` and `43214231`, selectors 0/1/2/3/7, independent geometric w,
and projected COUNT2/3/4 for FLOAT1/2. Both layouts contain twenty coordinate
floats per vertex; their selected-set offsets differ. Nonzero unused matrix
rows and translation distinguish the `(…,0,1)` input defaults. COUNT2 uses y
as divisor, COUNT3 z, and COUNT4 w; the two-dimensional sampler uses the first
two quotients. The new matrix has distinct divisor columns. Higher input
components are truncated only in the tested disabled-transform case.

Expected pixels come from authored coordinates and a standalone rational
interpolation / analytic mip oracle. No production FVF decoder, adapter,
sampler, shader or captured matrix supplies expected values. Tolerance stays
two bytes. `audit.py` independently recomputes all 2,960 browser observations
with Python Fractions and the authored color equation. It verifies public Lock
bytes, direct GL readPixels/error, all captured caps, and owning Worker backend,
context version and zero software/fallback/error counters. Observed mip levels
are 0, 2 and 3; this run does not extend the prior full mip-level qualification.

| Route, for each WebGL version 1 and 2 | Cells | Draws per cell | Pixels per cell | Expected rejections per cell |
| --- | --- | --- | --- | --- |
| Direct, nonindexed/indexed | 2 | 92 | 276 | 14 |
| Owning Worker, nonindexed/indexed | 2 | 164 | 464 | 14 |

Totals: **eight cells, 1,024 successful Draws, 2,960 observations, 144 held
matrix/selector mutation pairs and 112 explicit HRESULT rejections**. The
normal module supplies these pixels. Both exact modules pass public COM
bootstrap; no new compatibility-module pixel claim is made.

Separate actual-WASM software execution passes both direct/indexed positives
(552 observations and 28 rejections) and five semantic controls. Every control
reaches a successful public Draw and rejects non-Clear rendered pixels at the
pixel oracle: wrong selector, nonzero missing v, missing default w, wrong COUNT
divisor, and swapped FVF dimension fields with unchanged total stride. These
controls do not earn credit through setup failures. The same five controls are
planned for direct and owning Worker WebGL1/2, but none completed before the
launcher failure. The prior 36 controls remain their previously accepted scope.

## Browser closure and tested launcher repair

The sole Chrome 151.0.7922.71 on `bx_gyunxs8u` opened at
**09:27:04.295Z**. All eight positive rows were saved. `boat exec --timeout 60`
then terminated the process at **09:28:03.202Z**, exit 143 / SIGTERM, before any
new negative result was saved. Raw `result.json` therefore correctly retains
`PREPARING`, without a fabricated PASS or normal-close timestamp. The first
closure inspection at **09:28:17.551Z** finds both Chrome and Node absent and
the HTTP port closed. No rendering semantic failure was observed in completed
positives. No browser was relaunched.

The concrete invocation fix is to use `boat exec BOX --detach -- COMMAND`, then
poll `boat exec BOX --status PID`. `--detach` cannot be combined with `--timeout`.
An actual detached Node control ran for 65.442 seconds and exited zero, beyond
the failed 60-second boundary; `launcher-fix-start.json` and
`launcher-fix-status.json` preserve its complete output and timestamps. This
validates the launcher fix without consuming a second browser. The fixture's
own 14-minute timer and explicit hard close remain the browser limits for any
separately authorized future invocation.

## Recovery, validation and custody

Evidence: `scratch/runs/20261104-legacy-coordinate-dimensions/`.
The actual tested checkout SHA and production hunks are in `git-sha.txt`,
`source-seal.json` and `relevant-before.diff`; the owned new test is preserved
as `owned-test-before.patch`. The final test changes only a layout comment;
`comment-only-proof.json` verifies identical serialized fixture, oracle and
configuration. `source-provenance.json` records source hashes.
Git is the source archive. No source archives, media copies, module evidence
copies, allocation, source-box access, local heavy browser, subworker,
successor, game or deployment was used.

The required locked full build passes and reproduces both transferred modules:

| Module | SHA-256 |
| --- | --- |
| Normal | `7d096ed4ae107f8a062fb1ffd725b80ef6a0aab9f29f6d8e5764fe9fe45438e9` |
| Compat | `51c0ab6770512fc5b2f1aa4b561edcb6910630e47628303de3edfc60b3c6a101` |

Modules were transferred directly into runtime build paths under the build
lock, with full SHA verification. Before Chrome, local cache graph checks
(98 page / 13 Worker scripts), generated-region build gates, actual Puppeteer
CJS/ESM imports, dependency lock, all 45 runtime pins, HTTP bytes/isolation,
public COM bootstrap of both modules, and offline positive/negative tests pass.
The existing native expanded fixture's software/physical Worker tests and the
FVF lighting / VB regressions also pass. The slim runtime has no full index page
or cache checker; its actual imported Worker closure is pinned. Some initial
local helper/command mistakes are preserved as command failures, not pixels.

`remote-artifacts.json` and `recover.log` verify fourteen recovered artifacts,
including all eight screenshots. Direct WebGL1/nonindexed and owning Worker
WebGL2/indexed captures were personally viewed: textured triangles and clear
outside regions are present. They do not qualify hardware or gameplay. CDP identifies SwiftShader / SwANGLE.
`result.json.gz` losslessly retains the original **53,140,510-byte** partial
result, SHA-256
`543bad998c887631aee31557baf3973715b698c7449d7859136c43efedcd4fc8`.
`closed-process-pins.json` confirms all 45 pins unchanged, Chrome absent and
HTTP closed. Large local software/regression JSON is retained losslessly with
original and compressed hashes in `lossless-compression.json`.

Custody returns to the coordinator: **bx_gyunxs8u remains RUNNING / API idle,
healthy and hydrated**, expiry **2026-11-04T09:56:26.965Z**. Shutdown ownership
remains with the coordinator. No box lifecycle action was taken. Remaining
work is transformed FLOAT3/4 support and the unexecuted new WebGL controls;
this worker stops after publishing the bounded repair and exact first failure.
