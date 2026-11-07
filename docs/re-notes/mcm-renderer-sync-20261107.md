# MCM renderer synchronization: native16 queries and Flip completion

One fresh local production `dx_boids` sample reproduces delayed live identity
reads and separates two measured renderer waits. Native16 error queries are a
synchronous observation point; Flip also waits for outstanding GPU work to
complete. Removing error queries is **not a demonstrated correction**: their
elapsed time can include preceding GPU work, and substantial Flip waits remain
even in intervals with little error-query time. No production code changed.
This is an observation prerequisite for the MCM investigation, not original
gameplay, responsiveness, FPS, or parity acceptance.

Evidence: `scratch/runs/20261107-mcm-renderer-sync/`. The predecessor is
[`mcm-worker-cdp-latency-20261107.md`](mcm-worker-cdp-latency-20261107.md),
terminal `aae0f01e8`. This worker used its executable preparer and driver in the
fresh owned directory, then added run-only completion/result instrumentation.
There was exactly one Chrome launch, with two captures through the unchanged
live identity chain and no input. No original, box, accepted fixture matrix,
held retry, private input callback, or guest/config/clock write occurred.

## Executed identity and coverage

Source commit: `df0bbae0c5af942debbcdd45f5537ea3be97fd13`.
`source-sha.txt`, empty `initial-relevant.patch`, and `new-wininit-boot.patch`
record Git and relevant uncommitted source. The actual guest and owning renderer
module recovered through CDP is SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`,
2,182,493 bytes, retained once under `sample/`. Chrome was
`151.0.7922.108`, V8 `15.1.206.16`, headless local WebGL with
`--enable-unsafe-swiftshader`. The actual GL renderer/vendor string was not
collected; that flag alone does not establish the executing GPU backend.

All 171 served source-response hashes and lengths matched existing files;
39 successful media-response references retain existing paths, hashes and
lengths. Full HTTP records, including other responses, are in
`sample/served.jsonl`. Source and media were not archived or copied into runs.
Own new scripts and this note have individual binary patches.

`python3 scratch/runs/20261107-mcm-renderer-sync/analyze.py` verifies:

- Zero dropped rows: guest 166 rows, renderer 378 rows. Both recorder reads
  precede their immutable 60-second instrumentation deadlines.
- Every retained begin has an end; every guest span, renderer replay batch,
  and Flip fence is represented. Renderer calls at least 2 ms and successful
  GPU fence polls are retained; all completed instrumented calls are counted.
- Five delayed reads match the exact production guest identity-expression hash
  and lie entirely inside both coverage windows. Each reply follows its
  enclosing guest slice by 2–6 integer wall milliseconds.

This is complete coverage of the instrumented calls within those windows,
not every renderer function, browser startup, fast-call timelines, or work
still in flight when the recorder was read. In particular, the sample did not
wrap synchronous `fence()` or shared-message service as separate spans;
their instrumented native16/GL calls still contribute counters and slow rows.
Nested durations below must not be added as CPU costs. Date timestamps have
millisecond precision; durations use each Worker's monotonic clock.

## A delayed request through renderer and GPU completion

The identity request at **15:05:26.604Z** replies at **15:05:31.202Z**,
latency **4597.86 ms**. Guest slice35, requesting 100000 blocks, runs from
15:05:26.392Z to 15:05:31.200Z. The request overlaps 4593 ms of guest
`_waitFor`, 1560 ms of retained renderer `getError`, and 2371 ms of Flip fence.

| Event | UTC, 2026-11-07 | Evidence |
| --- | --- | --- |
| Native16 `getError` inside replay batch48 | 15:05:26.699–28.152 | 1452.78 ms; returns `NO_ERROR`; exact `_storeNative16` parent retained |
| Batch48 replay completes | 15:05:28.313 | Sequence48, eight commands |
| Guest wait for sequence49 returns | 15:05:28.426 | Identity request remains pending |
| Batch50 Flip fence | 15:05:28.427–29.207 | GPU poll returns `CONDITION_SATISFIED` at 29.205; guest wait51 returns 29.207 |
| Guest wait54 returns | 15:05:29.605 | Identity request still pending |
| Batch55 Flip fence | 15:05:29.607–31.198 | GPU poll returns `CONDITION_SATISFIED` at 31.186; guest wait56 returns 31.199 |
| Slice35 returns; identity reply received | 15:05:31.200; 31.202 | No reply at either earlier GPU completion or guest wait return |

`analysis.json` retains all five requests, matching waits/batch sequences,
completion results, and the slow native16 queries with their parent calls.
Another read, 15:05:19.275Z, waits **4896.99 ms** while overlapping only
39 ms of retained `getError`, but **4432 ms** of Flip fences. Therefore this
sample does not support treating error-query removal alone as a responsive
identity-read fix.

Across the renderer window, 15,632 `_storeNative16` calls make exactly
15,632 `getError` calls, all returning zero. Error queries total **4374.28 ms**
inside **4489.03 ms** of native16 storage. Native GL draw/copy submission calls
return quickly: 31,264 `drawArrays` calls total 13.23 ms and 15,632
`copyTexSubImage2D` calls total 6.60 ms. Those submission times are not GPU
execution times.

Eight Flip fences total **13924.34 ms**. Their 3359 polls comprise 3351
`TIMEOUT_EXPIRED` and eight `CONDITION_SATISFIED` results. Poll API calls total
45.01 ms; eight buffer collections total 79.28 ms. Most fence wall time lies
between issue and GPU completion, including task scheduling. This is actual
pending GPU completion evidence, not proof that all of that time is unavoidable
GPU execution or a measurement of GPU utilization.

## Correction boundary and executable next step

The source path is `D3DIMGpu._submitImmediate` → one native primitive draw →
`_storeNative16` → full-target color copy and conversion quad → `gl.getError`.
This preserves native16 high bits after each primitive, including overlapping
primitives inside a public draw. `fenceFlip` separately issues a PBO readback,
polls a GPU sync, collects bytes and writes them back before replay publishes
completion. The guest's synchronous `_waitFor` and uninterrupted `ex.run`
retain the pending identity read until the slice returns.

The **query synchronization point is measured**. Its **avoidable fraction is
unknown**. A zero result does not justify suppressing error handling, moving
failure past later draws, or changing native16 storage order. Nor does the
trace justify timeout, yield, budget or freshness changes. There is no
failing-before/pass-after production correction here, so no source edit or
new locked production build is claimed.

The prepared follow-up adds Chrome GPU-service tracing to the same sparse
probe, plus explicit synchronous `fence` and shared-message service spans.
It is syntax-checked and has mocked trace lifecycle/category controls, but
**has not launched a runtime**. For a separately authorized next sample:

```sh
python3 scratch/runs/20261107-mcm-renderer-sync/prepare-gpu-service-probe.py
CASE=gpu-service-next SPANS=1 BROWSER_DEADLINE=$(($(date +%s%3N)+180000)) \
  node scratch/runs/20261107-mcm-renderer-sync/gpu-service-browser.cjs
```

It requires available GPU trace categories, records host/Worker clock mapping,
retains the service trace with a 64 MiB cap, and stops without replay on failure.
Correlate GPU process/service events during a long native16 query with its
preceding copy/draw commands and later Flip completion. If the driver exposes
no execution/completion detail, retain that limitation rather than subtracting
query wall time as a predicted speedup. Any proposed checkpoint correction
still needs an error-injection regression proving failure before completion,
native16 primitive order and state restoration, then a locked build.

## Checks and terminal state

The bound helper is unchanged, SHA-256
`9df1455f51f91d76e17890ff4d90afe9264759d3e30e224a9a7569e29b1f8062`.
Offline controls pass for all 16 required identity fields, missing/replaced
owners/modules, stale zero effects, object mismatch closure, UP sent before a
pending DOWN acknowledgement, wrong-number ACK timeout, mismatched prior ACK
ID, and sticky UNKNOWN after a late ACK. The actual sample sends no native
input or numbered transport commands; it does not claim live input acceptance.
Recorder controls verify one-for-one native calls, unchanged return/promise/
throw identity, scalar GPU results, native16 parent/batch association, explicit
drops, uncapped aggregates, expiry bypass and restoration.

Focused existing Node regressions `test/test-d3dim-async-readback.js` and
`test/test-d3dim-gpu-batching.js` pass without additional browser launches.
`ops/check-run-evidence.js` reports the pre-existing Alice containment error;
none of its errors/missing/invalid entries names this run. Own hashes, script
syntax, correlation assertions and documentation whitespace pass.

Chrome exits code0; exact driver/Chrome PIDs are absent, server/debug ports
closed, wrappers restored, profile and writer lock absent. The messageboard
watcher is closed before release. Free disk is sampled above 3 GB; no continuous
disk claim. No box was assigned: ID/state/expiry are not applicable and lifecycle
ownership remains with the coordinator. This bounded worker releases its paths
and stops after its explicit documentation commit and immediate pull/push.
