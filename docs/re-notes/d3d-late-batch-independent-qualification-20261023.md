# Independent D3D late-batch fixture acceptance, 2026-10-23

**Verdict: ACCEPT the fixture repair as a correction to the documented production contract, with fresh offline acceptance. Native qualification remains BLOCKED and unclaimed.**

Reviewed candidate `09dc88de08907d362eef2ac5dbbaad0080147358`, branch
`task/d3d-late-batch-failure-repair-oct23`, directly against its parent and exact
main `7f7358c160ae7185fc38f9a15447a6d20c00f97e`. This independent report branch
starts at that exact main. No production or regression-fixture corrections were
needed or made. The candidate changes no `lib/` or `src/` bytes, preserving the
accepted whole-large-arena fix and its existing arena-reuse regression.

## Independent contract assessment

The original assertion was applied in the wrong execution mode. Production
`Device.prepare` explicitly chooses streaming when deferred peak reservations
cannot all coexist, and explicitly allows earlier batches to remain drawn after
a later failure. This deliberate contract predates the repair (streaming change
`3a908f97bafc0a25f18938b1f4913fae959115ed`). Retained mode prepares every batch
before its first raster step. Both modes publish samples only after full success.
Queue failure and retirement do not promise pixel rollback. Exact source blobs,
SHA-256 identities, extraction recipes, excerpts and the actual fixture diff
are retained in adjacent `contract-review.json`.

The repair restores the original budget before exercising retained-mode
atomicity and asserts the mode. It separately selects streaming and compares
late failure with a successful two-batch prefix, while requiring unchanged
published samples, baseline device accounting, no live contexts and no pending
setup records. It retains exact success pixels and `800 * 36` samples. This
preserves an atomic assertion where the implementation promises one; it is not
acceptance obtained solely by removing an oracle.

The new native test assumptions are valid for this fixture:

- The splitter has both a 256-triangle and a 256-distinct-vertex limit. This
  unindexed input has three distinct vertex records per triangle. Independent
  execution of the actual splitter yields index counts
  `[255,255,255,255,255,255,255,255,255,105]`. Descriptor count is the input index
  count, so the first two saved counts divided by three yield **170 triangles**.
  Independently splitting the sliced prefix produces byte-identical vertices
  and indices for exactly those two batches. Saved record values are copied
  numbers, not later reads from freed context addresses.
- `live.delete(pointer)` tracks a lifetime, permitting reuse after retirement.
  The pending descriptor entry is removed at completed preparation or release.
  The fixture uses immediate/deferred constructors without typed constants or
  user clip planes, so its wrappers cover these exercised paths. A fresh
  streaming control using one reused native address passes; a repeated release
  is rejected. This does not establish native allocator correctness.
- The fixture's small contexts remain eligible for ordinary shrink. The accepted
  whole-large-arena exemption applies to different, large context allocations;
  the separate arena-reuse test deliberately covers those and is unchanged.

Limitation: the native prefix repeats identical triangles, so equal final pixels
alone cannot distinguish one successful batch from two. The third-create
injection establishes the intended boundary in the JS path; independent offline
traces with distinguishable marker writes verify two raster calls. The new
native pixels, heap-header assertions and native release behavior still require
actual execution. No export-double result is treated as native evidence.

## Executed scope and rejecting controls

The adjacent `independent.js` executes the actual producer `Device` and geometry
splitter from the exact retained donor. It reuses the producer's explicitly
synthetic export fixture constructor, with independently written assertions and
mutations; it is not an independent native implementation.

Fresh results: **five positive checks and five rejecting controls PASS**.
Positive checks cover late retained/streaming failure, streaming address reuse,
saved-count prefix equality, and Set lifetime/repeated-release behavior. Controls
are required to fail with `AssertionError`, detecting missing native release,
premature sample publication, missing prefix writes, incorrectly accepted third
creation, and retained rasterization before all validation. Mutations exist only
in disposable test objects/in-memory fixture text. Production files are untouched.
The producer's complete nine-scenario harness was also freshly executed and
passed, including synchronous/asynchronous failures, cancellation, success and
ordered-queue failure. Commands and receipts are adjacent in `execution.json`,
`independent-results.json` and `producer-nine-results.json`.

Each Node invocation used `--max-old-space-size=256`, MemAvailable admission
805,306,368 bytes, CPU/wall 60 seconds, per-file limit 25,165,824 bytes and streaming
aggregate capture enforcement at 524,288 bytes. Python invocations used wall 60.
The retained wrapper is `run.py`. One broad source capture hit the streaming cap
and was killed; it was not retried. Later source excerpts were selected inside
Python before output. The receipt records that guard failure explicitly.

## Native admission and exact remaining gap

Before checkout, `closure-review.py` compared the exact three entrypoints with
their transitive literal imports, directory-enumerated WAT sources and four
dynamically loaded compiler stages. Their measured Git input inventory is
23,342,723 bytes, with per-file blob IDs and SHA-256 hashes in
`native-admission.json`. A cold materialization projects 81,512,518 bytes against
67,108,864, before backend fonts or external packages. Standing root inputs were
compared byte-for-byte: 15,236,466 inventory bytes do not match or are absent.
Standing sources can reduce copied bytes but do not supply a runnable exact
closure by themselves. No source was copied or linked to conceal its cost.

The actual entrypoints require `render-helper`, which calls `compileSrcWasm`
synchronously and then instantiates in the same process. There is no phase
boundary enforcing compiler heap 2,048 MiB/900 seconds/MemAvailable 2,684,354,560
versus native heap 512 MiB/150 seconds/MemAvailable 1,610,612,736, nor the 8 MiB
module bound. Running the combined entrypoint with a 2,048 MiB heap would violate
the native heap guard. Calling it a cheap 256 MiB Node test would misclassify its
compiler work. No approved phase-separated runner or exact qualified artifact
was supplied. Standing root `build/*.wasm` and producer `*.wasm` inventories are
empty. The compaction and arena-reuse tests add different `extraWat` exports, so
even an ordinary old module would not be a substitute.

The standing dependency resolution additionally returns `MODULE_NOT_FOUND` for
unconditionally required **pngjs**. Optional GL providers are absent too; their
absence is not used to claim they are needed for the software route. No package
was installed, no archived recovery attempted, and no native gate continued
past the failed prerequisite. The static import inventory is not represented as
a fully resolved native dependency closure. Backend default fonts would also
need measured identities if that test were admitted.

Thus no compiler, Wasm instantiation, native pixels/resources, compaction native
test, arena-reuse native test or backend suite ran. No candidate/module/compiler
execution hashes can be claimed; candidate and compiler **source** identities
are sealed in the manifest. The remaining gap is precisely those real-export
tests under a complete resolved, resource-admitted, phase-enforced closure.
This bounded task ends with that blocker, without proposing a successor task.

## Resources, publication and ownership

First measured admission preceded checkout: **58,169,795 / 67,108,864 bytes**,
including full shared SQLite WAL/SHM, measured session/launcher logs, 16 MiB future
growth, 6 MiB private Git/input/temp/evidence cap and 8 MiB reserve inside the
allocation. Projected host remaining: **4,551,976,509 >= 2,982,150,144 bytes**.
Installed tool sizes/hashes and standing donor footprints are separate in
`admission.json`. The private repository uses an explicit read-only Git alternate
to the producer's existing Git store; no root refs or index were modified.
Final measured accounting accompanies the report. Important evidence and recovery
scripts are tracked; donor locations are dependencies, not remotely backed-up
native artifacts. To reproduce offline, check out both named exact revisions and
adjust the donor path in `independent.js`; installed Node alone runs those checks.

No workers, guest/game work, box operations, SSH access retries, credentials,
main merge or unrelated edits. Box ID/state/expiry: **N/A**. Both supplied prior
boxes remain stopped; lifecycle belongs to the coordinator. Shadow Man and the
Airstrike/Penguin lanes were untouched.
