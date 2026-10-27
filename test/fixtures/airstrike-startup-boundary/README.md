# Airstrike Space startup boundary

Outcome: source-backed blocker, no causal controller repair established.
The controller and bridge at 097f3b2904d833ca8fb152e686032c156c16e39a
are unchanged. This fixture adds a reproducer and rejecting controls only.

Run `python3 -B test/test-airstrike-startup-boundary.py` under the assigned
Python/resource supervisor. It runs the actual controller CLI against retained
production NDJSON receipts. It does not run a guest or an assembled substitute
runner. The two original groups ran separately: RetainedReproducer first,
then RejectingControls and BridgeBoundary, with no unchanged group rerun.

The original runtime used runner b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a
(SHA256 4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809).
The current source closure is 1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba
(runner SHA256 6dc104b3c10db701c0b1aec5954dd00cc29a7b6009970a5876ccc27426e7fa9e).
Both were read from immutable Git objects. Exact source excerpts in evidence
are static evidence, never executed. They establish that a frozen queue ACK
is not input dispatch, a `[input]` line follows a renderer handler, and a step
ACK settles a batch without requiring a guest input dequeue or SDL event.
The actual retained log includes DLL initializers before the first ACK.
There is no new initializer or full-runner behavioral acceptance in this task.

Retained evidence establishes caption activation at batch5000, Space down at
5001, Space up at5002, then frozen batch5003/zero credits. Each snapshot has
EIP0x55995b; no `[check_input]` delivery is logged. The 5ms batch base advances
only 10ms from Space injection to the final snapshot. Guest/API ticks within
batches were not measured, so this is not a bound on total guest time.
Review starts at34.137635s and the original deadline expires at115.091009s:
the remaining80.953374s is frozen review time, not guest progress. The startup
image is unchanged. This does not prove lost keys, wrong focus, a sleep,
a deadlock, a broken SDL pump, or a required key-hold duration.

The unchanged production-protocol replay emits only the exact caption click,
Space down and Space up, then exits2 with insufficient-observation. Queue-only
ACKs, partial steps, nonzero credits, mismatched input IDs and absent execution
logs stop before release/navigation. Stale or obscured startup observations
stop before Space. The actual bridge's completion validator likewise rejects
partial steps and pending credits. No test sends Esc, Down or Enter, and all
child controller processes are reaped under the trusted supervisor.

No repair is invented: the missing prerequisite is guest consumption/forward
progress beyond two batch completions. A later coordinator-authorized diagnostic
must observe the frozen renderer queue/key state and main/cooperative-thread
wait/sleep state at the Space boundaries, with actual dequeue/route/dispatch
and SDL-pump evidence where available. The current runner has optional
consumption tracing; `--trace-input` in the historical run only traced renderer
mouse routing. Any resulting shared runner/renderer/emulator repair requires
separate ownership. Do not replay keys, force guest state, relax gates or extend
the deadline as a substitute for that observation.

The canonical receipt is `receipt-manifest.json`; its publication receipt is
external because the Git commit containing the manifest cannot embed its own
hash. Exact final commit and remote ref are recorded in the root messageboard.
No new guest, Boat, compiler, download, build, ordinary Quit or gameplay claim.
All predecessor evidence and compiled modules remain unchanged. Historical
box bx_ffsw74qe was snapshot-stopped by the coordinator before this assignment;
this task owns no box or lifecycle operation.
