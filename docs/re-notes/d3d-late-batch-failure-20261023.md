# D3D late-batch create rejection, 2026-10-23

The defect is in the compaction fixture's choice of execution mode. Its original
no-pixel-change assertion is valid for retained-context preparation, but the
preceding budget reduction selects streaming and remains in effect at that
assertion. No production renderer change is justified by this failure.

Input and read-only remote main: `7f7358c160ae7185fc38f9a15447a6d20c00f97e`.
Private branch: `task/d3d-late-batch-failure-repair-oct23`.
The accepted `src/10-helpers.wat` large-arena reuse is preserved byte-for-byte.

## Contract and cause

- `lib/d3d9-software-backend.js:550` explicitly selects streaming when
  `holdsBatches` cannot admit all deferred peaks. Its comment explicitly permits
  a late failure to leave earlier batches drawn. Commit
  `3a908f97bafc0a25f18938b1f4913fae959115ed` introduced that behavior deliberately.
- `step` prepares, rasterizes and retires each streaming batch before creating
  the next. The comment near line 1096 promising every batch validates before
  pixels follows the streaming early return and applies to retained contexts.
- `test/test-d3d9-software-backend.js:761` already requires streaming under a
  constrained budget to match retained-mode success pixels and sample totals.
- `d3d9-host.js:499` describes synchronous parameter validation followed by
  asynchronous driver consumption and deferred device faults. `Device.execute`
  returns async completion failures; `CommandQueue._retire` faults the ordered
  stream. These consumers provide error propagation and retirement, not a
  transaction rolling back prior color/depth/stencil writes.
- The compaction fixture lowers `d.budget` to `oldSum-1`, using a sum of immediate
  allocation bounds. Admission uses deferred bounds plus packed input bytes.
  This selects streaming even though compacted retained contexts are smaller.
  The injected third create rejection therefore follows two rasterized batches.
  The original test did not restore the full budget until after its assertion.

The focused fixture repair restores the original budget and asserts retained
mode before preserving the original no-pixel-change assertion. A separate
constrained-mode rejection compares pixels with an independently rendered
two-batch prefix, requires a visible change, and verifies unchanged published
samples, baseline device bytes, zero live contexts and zero pending setup records.
Successful constrained rendering still requires the original exact pixels and
`800 * 36` samples. Export wrappers now detect repeated context release.
No target rollback buffers or production memory reservations were added.

## Executed offline evidence

`d3d-late-batch-failure-20261023/device-fault-injection.js` calls the actual
production `Device.prepare`, `prepareBatch`, `step`, `draw`, `drawAsync`, `cancel`,
`execute`, retirement and release code, and the actual `CommandQueue` consumer.
Only exports are doubled. Synthetic IR headers bypass real shader compilation;
synthetic bounds exercise admission, and synthetic raster exports write one
distinct marker per batch. They do not emulate native geometry or allocator
behavior. The receipt is `d3d-late-batch-failure-20261023/results.json`.

Nine scenarios pass: third-create rejection in both modes, synchronously and
asynchronously; cancellation after the first raster in both modes; successful
async rendering in both modes; and deferred queue failure. The failure trace is:

```
retained: create1 prepare1 create2 prepare2 create3(reject)
streamed: create1 prepare1 raster1 create2 prepare2 raster2 create3(reject)
```

Both failure modes return every command-owned byte/program/context and preserve
published sample totals. Cancellation leaves the one already written marker and
publishes no samples. Success produces identical marker buffers and 800 samples.
Streaming retains at most one context. Queue failure rejects its fence and
retires its bytes and inflight entry. These are JS sequencing results, not native
acceptance or evidence of a naturally occurring native allocation failure.

Executed commands (from the private checkout):

```
python3 /tmp/d3d-late-batch-oct23/run.py node --max-old-space-size=256 docs/re-notes/d3d-late-batch-failure-20261023/device-fault-injection.js
python3 /tmp/d3d-late-batch-oct23/run.py node --max-old-space-size=256 --check test/test-d3d-software-compaction.js
python3 /tmp/d3d-late-batch-oct23/run.py git diff --check
```

The native compaction and existing backend suites require `render-helper`, which
calls `compileSrcWasm`. They were **not executed** under this assignment. Their
updated native assertions, real pixel/sample equality, native allocator release,
and preservation of the accepted arena optimization remain to be qualified by
an explicitly authorized resource-admissible native run. The coordinator's prior
control/candidate failure at original line 91 is supplied historical evidence,
not a fresh native run by this worker. No guest/runtime access was attempted.

## Resources and recovery

First admission preceded checkout: projected 58,837,052 / 67,108,864 bytes,
including measured full shared SQLite WAL/SHM, recent session logs, 16 MiB future
log growth and an 8 MiB reserve. Standing SQLite bases, installed executables,
and existing read-only Git/Codex data are separately inventoried in admission
receipts. Installed Node is executed in place (123,656,816 bytes); it is not copied.

An initial private-tree suballocation check stopped at 6,463,921 bytes versus
6 MiB before tests. The revised projection admits an 8 MiB private tree and
1 MiB external-launcher logs: 61,982,780 / 67,108,864 bytes, with 4,552,026,052
host bytes remaining after projection. No operation retried that failed check
unchanged. Receipts and bounded command wrapper are retained under
`/tmp/d3d-late-batch-oct23/`; published copies accompany this report.

The wrapper checks MemAvailable >= 805,306,368, CPU/wall <= 60 seconds, per-file
output <= 24 MiB and streams counted output before forwarding it, with an
aggregate 524,288-byte cap. Node uses 256 MiB old space. An intermediate receipt
capture used a finite subprocess pipe; the published receipt was regenerated
through the streaming wrapper directly to disk. No native compiler/module was
invoked. Recovery: clone the published task branch normally and run the offline
script; the script needs only installed Node and repository JS. The private
checkout uses an explicit read-only alternate to the existing root Git objects
(standing measured donor 632,540,191 bytes), rather than copying those objects.
No newly acquired binaries or ignored native artifacts need remote recovery.

No assigned box: ID/state/expiry N/A. Supplied boxes `bx_dskdnj43` and
`bx_qv9vszay` remain authoritatively stopped; lifecycle belongs to the coordinator.
No workers launched, no shared root index/ref changes, no merge or registry edits.
