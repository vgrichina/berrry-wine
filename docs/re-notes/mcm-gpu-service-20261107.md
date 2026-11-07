# MCM GPU service: bounded trace retrieval failure

One local production `dx_boids` sample reproduced delayed live identity reads
and measured synchronous fence/shared-message service explicitly. **GPU
execution versus scheduling remains unknown:** Chrome accepted trace start/end,
but did not deliver `Tracing.tracingComplete` within the retained preparer's
10-second flush wait. No stream was recovered, and no runtime was repeated.
There is no demonstrated production correction or avoidable-query speedup.

Evidence: `scratch/runs/20261107-mcm-gpu-service/`; predecessor
[`mcm-renderer-sync-20261107.md`](mcm-renderer-sync-20261107.md), `b3463ba3a`.
The retained preparer and dependencies were copied into this owned directory.
Run-only adaptations add explicit native16 copy/conversion draw timestamps and
Worker `console.timeStamp` clock markers. Production module, automatic config,
input guards, native16 order and error handling were unchanged. Exactly one
Chrome launch, two bound captures, zero input, zero original/box launches.

## Identity and coverage

Source SHA: `ee103ca0662c47fcbba6e5f95b50b3cddd161062` (`source-sha.txt`).
`initial-relevant.patch` and `new-wininit-boot.patch` preserve relevant dirty
source. Both actual Worker modules have SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`,
2,182,493 bytes, retained once. Chrome is `151.0.7922.108`, V8 `15.1.206.16`;
the launch uses headless WebGL and `--enable-unsafe-swiftshader`. The early
backend read returned an empty target list, so the actual driver is unknown.
172 successful served source responses match local lengths/hashes; 38 media
responses reference existing paths and SHA-256 values. No source/media archive.

`python3 scratch/runs/20261107-mcm-gpu-service/analyze.py` passes: guest 212
rows and renderer 2576 rows, dropped=0, paired begin/end spans, recorder reads
before their immutable 60-second expiry. All six delayed identity reads fall
within both coverage windows. Every instrumented guest call, replay batch,
shared message, synchronous fence and Flip has complete recorded coverage.
Other renderer calls retain slow rows (at least 2 ms), errors and successful
sync polls, with uncapped counters for completed calls. Fast native16 stores
are counted rather than individually retained. Coverage does not include
startup, every renderer function, or calls still pending at recorder read.
Nested durations are not additive CPU costs.

## Measured causal chain

The identity request at **15:18:07.366Z** replies at **15:18:12.910Z**,
5543.65 ms later. Guest slice47 runs 15:18:07.300–12.907, requesting 100000
blocks. The request overlaps 5530 ms of guest `_waitFor`, 5528 ms of
shared-message service, 1733 ms of synchronous `fence`, and 4721 ms of retained
`getError` calls. The categories overlap and must not be summed.

At 15:18:07.368, native16 store70083 copies the target and submits its
conversion `drawArrays` before `getError`70086; both submissions return within
the same integer wall millisecond. That query returns `NO_ERROR` at 07.526,
after 158.405 ms. Its retained parent records monotonic copy/draw/query order
and replay context. `analysis.json` retains the other slow parents and queries.
This proves a synchronous observation point after command submission, not the
amount of avoidable query overhead or preceding GPU execution time.

Later Flip fences run 15:18:09.673–09.688 and 12.877–12.902. Sync polls return
`CONDITION_SATISFIED` at 09.683 and 12.900. The identity reply remains pending
through the first completion and arrives 3 integer milliseconds after slice47
returns. Actual GPU completion evidence therefore coexists with delayed Worker
evaluation; neither proves a safe change to slice budgeting or error checks.

Across the renderer window: 18,386 native16 stores and exactly 18,386 error
queries, all zero, take 26,421.00 and 26,185.89 ms respectively. There are
36,772 `drawArrays` submissions (25.14 ms), 18,386 copies (15.89 ms), 19
synchronous fences (6279.93 ms), 106 shared-message services (29149.09 ms),
87 replay batches (22861.53 ms), and ten Flip fences (2163.14 ms). Sync polls
comprise 518 `TIMEOUT_EXPIRED` and ten `CONDITION_SATISFIED` results. Instrumentation
and trace overhead are unmeasured; these are sample observations, not comparable
performance measurements against the predecessor.

## Trace blocker and executable next step

`trace-categories.json` verifies `gpu`, GPU service/decoder/device/debug,
command queue and other GPU categories were available. The driver selected
all available GPU categories plus timeline/user timing. It requested
`ReturnAsStream`, with a 64 MiB write cap checked before writing each chunk.
No stream arrived, so retained trace bytes are zero. Worker clocks satisfy
`timeOrigin + now` versus `Date.now()` to millisecond rounding; marker requests
are retained in `trace-clock-markers.json`. **Trace-to-Worker clock mapping is
unverified**, because the trace containing the markers is missing. Category
availability and accepted start/end do not establish trace coverage, trace
drop0, service execution or scheduling. The first terminal failure is preserved;
there is no assumption about why Chrome did not finish flushing.

The unlaunched `next-trace-browser.cjs` / `next-trace-control.cjs` preserves the
same probe and identity chain, selects service/decoder/command-queue categories,
records all trace notifications and buffer usage, and allows a bounded
60-second completion wait with 15 seconds reserved before the immutable browser
deadline. It retains the 64 MiB cap and stops on failure without replay:

```sh
CASE=trace-recovery SPANS=1 BROWSER_DEADLINE=$(($(date +%s%3N)+180000)) \
  node scratch/runs/20261107-mcm-gpu-service/next-trace-browser.cjs
```

This is a separately authorized next sample, not executed here. Require a
complete stream, trace loss checks, matching clock markers and complete probe
coverage before classifying service scheduling versus execution. If the driver
does not expose execution detail, retain unknown. No timeout/yield/budget,
freshness, error suppression or native16 ordering correction is justified.
Any later correction still requires injected errors before completion,
primitive ordering/state restoration regressions, focused tests and locked build.

## Checks and terminal state

Run-only mocked controls pass for category availability, trace lifecycle,
small stream recovery, one-for-one native calls, return/throw identity,
copy/draw/query order, scalar results, native16/replay association, explicit
drops with continuing counters, expiry bypass and wrapper restoration. Bound
guard controls pass all 16 identity fields, owner/module replacement, stale
zero effects, exact ACK, independent UP and sticky UNKNOWN cases. No accepted
fixture matrix was repeated. Existing Node async-readback and GPU-batching
tests pass. No production code edit or new production build is claimed.
Evidence checker reports unrelated Alice and Tunnel/Twist containment errors
and historical missing/invalid records; none names this run.

Chrome exit0; exact driver/Chrome PIDs absent, server/debug ports closed,
profile absent, guest/renderer wrappers restored. Watcher closed on release.
Free /home sampled above 3 GB. No box assigned: ID/state/expiry not applicable;
no lifecycle action, coordinator retains lifecycle ownership. This worker
releases its paths and stops after the explicit documentation commit and
immediate pull/push. No original steering, FPS or parity claim.
