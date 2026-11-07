# MCM Worker observation: uninterrupted slice retains synchronous render waits

The bounded investigation closes with a measured blocker and no production
change. Fresh CDP identity reads on the actual production `dx_boids` Worker
route waited for the enclosing guest slice to return. Render completion
notifications and Atomics timeout returns inside that slice did not service
those reads. This is a local Chrome/SwiftShader observation prerequisite,
not an MCM performance result or an original-game acceptance result.

Evidence is in `scratch/runs/20261107-mcm-worker-cdp-latency/`. The interrupted
launcher2266488/child2266491 session was not reused. Its retained trace and
samples were recovered; no additional runtime was needed. Source commit is
`afe89042a8956b7fa0278bf561ea8df95ea853bf`; `source-sha.txt`,
`initial-relevant.patch` and `new-wininit-boot.patch` preserve relevant source
identity. The executing module recovered through CDP is SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
HTTP body hashes and lengths, including the existing media paths, are retained
in each sample's `served.jsonl`; no source or media archive was made.

## Measured boundary

Run `python3 scratch/runs/20261107-mcm-worker-cdp-latency/verify-boundary.py`.
It checks the actual guest identity-expression hash, zero guest recorder drops,
enclosing slice, intermediate completed waits, and reply alignment:

| Slice | Requested blocks | Identity latency ms | Reply after slice end ms |
| --- | ---: | ---: | ---: |
| 28 | 100000 | 2479.71 | 1 |
| 30 | 100000 | 3438.30 | 2 |
| 32 | 100000 | 4049.98 | 2 |
| 34 | 100000 | 1693.63 | 2 |
| 36 | 47000 | 2039.51 | 4 |

Every row crosses an earlier completed `_waitFor` without receiving its reply.
For slice28, the read starts at 14:54:08.899Z; a completion wait returns at
14:54:10.218Z, then the next wait includes a 1000-ms Atomics timeout returning
at 14:54:11.219Z. The final completion wait returns at 14:54:11.375Z, the slice
ends at 14:54:11.378Z, and the CDP reply arrives at 14:54:11.379Z. Thus neither
an intermediate completion nor the existing timeout is an observation yield.
Integer wall-clock timestamps have millisecond precision; these gaps include
transport and do not establish submillisecond ordering.

For that fully covered delayed read, `analysis.json` measures 2475 ms of
overlap with guest `_waitFor` and 2474 ms with nested `Atomics.wait`. Renderer
overlap includes 1205 ms in `getError` and 1153 ms in `fenceFlip`. These are
nested categories, not additive CPU costs. The guest CPU profile attributes
27283 of 27462 sampled wall milliseconds to `_waitFor`; renderer `getError`
accounts for 10618 of 27471 ms. Renderer fence polling can yield its own task
while the guest remains synchronously blocked waiting for replay completion.

The renderer recorder reached its 30000-row cap: 41892 rows were dropped,
and its last retained timestamp is 14:54:13.306Z. Later guest delays remain
fully recorded, but their complete renderer breakdown is unknown. The first
guest installation request also waited 3172 ms before instrumentation existed;
it must not be treated as a recorded guest slice. Two failed span installers
are retained separately and closed without input.

The observed 1000-block slices took 0.145–0.980 ms; the recorded
47000–100000-block slices took 1909–4051 ms. This does not establish that a
smaller budget fixes latency: a single synchronous render import can retain
its wait regardless of budget. `lib/guest-worker.js` calls `ex.run` inside an
uninterrupted handler; `lib/d3d-command-stream.js` loops synchronously in
`_waitFor`. The page's adaptive budget is updated only after `sliceDone` and
only for qualifying budget-consuming slices. No budget experiment was made.

## Executable next step and correction constraint

The next read-only probe is prepared and its wrapper transparency controls
pass (no new runtime was launched during recovery):

```sh
python3 scratch/runs/20261107-mcm-worker-cdp-latency/prepare-next-probe.py
CASE=boundary-next SPANS=1 BROWSER_DEADLINE=$(($(date +%s%3N)+180000)) \
  node scratch/runs/20261107-mcm-worker-cdp-latency/next-browser.cjs
```

Use a fresh CASE directory each time. This captures twice through the unchanged
live identity chain and closes its own browser. The prepared run-only recorder
retains all guest spans, renderer calls taking at least 2 ms and errors, plus
aggregate counters for every completed renderer call. Its 30000-row cap and
dropped count remain explicit. It avoids spending the cap on fast fence polls;
accept full coverage only if its dropped count is zero. Correlate one guest
identity request with complete renderer service and GPU fence completion.
The remaining unknown is how much of renderer service
is avoidable native16 error-query synchronization versus required GPU work;
removing `getError` is not justified by this profile alone.

A correction must either reduce proven unnecessary renderer synchronization
while preserving error handling and native16 draw order, or implement an
explicit resumable guest import boundary preserving completion tokens, render
buffers, scratch ownership and guest continuation. The current synchronous
Wasm import cannot safely become a Promise by changing its wait loop. Any such
production change needs a failing-before/pass-after regression and locked build.
No speculative timeout, yield, step-budget or freshness change is proposed.

## Safety and cleanup

The full live owner/module checks, 12000-ms freshness, exact numbered ACK,
independent UP and sticky UNKNOWN remain unchanged. `tools/mcm-bound-input.cjs`
remains SHA-256 `9df1455f51f91d76e17890ff4d90afe9264759d3e30e224a9a7569e29b1f8062`.
The retained samples only captured observations: no input dispatch, original
guest, boat, accepted fixture matrix, held-lane retry, or guest/config/clock
edit. No Dungeon Keeper helper/test was touched.

All four retained browsers exited code0. Recovery verifies their exact driver
and Chrome PIDs absent, server/debug ports closed, profiles and writer locks
absent. The predecessor's orphan messageboard watcher (PID2275380, exact
retained PID and command verified) was terminated with SIGTERM. No browser
required termination. No test box was assigned: ID/state/
expiry are not applicable, and no box lifecycle action was performed.
`recovery-cleanup.json`, `boundary-verification.json` and the final evidence
manifest record those checks. The predecessor locked build and run-only probe
controls passed; this recovery reruns the recorder controls and boundary checks.
Only this documentation is committed. Free space was sampled above 2 GB.
