# Alice desktop timeout diagnosis — 2026-11-04

The retained batch1681 failure does not identify a causal production repair.
No production code changed. Focused transport tests reproduce the same timeout
from two different causes, so changing the timeout or retrying the operation
would not be justified. Alice gameplay remains blocked pending worker evidence.

Evidence: `scratch/runs/20261104-alice-desktop-timeout-cause/`.
The previous run and its actual first failure remain unchanged in
`scratch/runs/20261103-alice-provisioned-dialogue/`; see
[the original report](alice-provisioned-dialogue-20261103.md).

## What the retained inputs establish

Alice tested source `277f9a32c984562ef33b2d32a5c13df949b5f87a`, canonical module
`065267ce7c208cb369b1fa930425627b3a238c9e184e5aa46d8ef16143b8b5b8`.
Analysis began on main `fa2c432e90bf5a084d929d08a6abce235aca3e06`.
Current `lib/process-desktop.js`, `test/run.js` and `lib/thread-manager.js`
match both that tested Git revision and their recovered runtime SHA256 pins.
`input-identity.json` records those comparisons and hashes the reviewed logs,
launch/preload inputs, first error, progress and handoff without copying them.

The original stack is `receive:29 -> call:179 -> poll:263 -> check_input:365`:
the guest input import, rather than the runner's separate between-batch poll.
`publish()` returned before this call. The failing operation was
`{op:'poll',limit:256-pending.length}`; its actual limit and desktop request
sequence were not logged. Batch1681 and EIP `0x0046c288` identify where the
host exception reached the guest; they do not diagnose guest instruction failure.
Request34 (`step n36`, from1666) later lost HTTP response and the original exited1.
The unknown completion of that request remains unknown.

`receive()` waits3000ms on the shared response word. The client worker receives
the request through a MessagePort, writes a newline-delimited Unix socket frame,
then copies the authority reply into that buffer and notifies the caller.
The authority's poll removes up to256 queued messages with `splice()` before
writing its response. Missing a response can therefore lose knowledge of an
already-consumed poll; retrying is unsafe. `call()` closes and terminates its
bridge on ETIMEDOUT/ECONNECTION, forbidding reuse of its response buffer.

The authority and bridge are real Node worker threads even with `--no-threads`.
That flag selects cooperative *guest* scheduling. The desktop workers own their
own socket event loops, so the main thread's synchronous Atomics wait alone is
not a demonstrated circular wait. The authority's poll handler is bounded;
there is no guest callback or wait for the main thread in that handler.
The main runner also polls before each batch, independently of frozen credits.

Both worker `error` handlers discard errors. Parent `error`/`exit` callbacks
would also require a main event-loop turn; they cannot wake this synchronous
wait themselves. Bridge socket error/close does notify a pending caller with
ECONNECTION, but a dead or stalled bridge cannot do that. A stalled authority
can leave the socket open. The log has no bridge/authority lifecycle or request
phase record, per-thread scheduling sample, or timeout-time shared-buffer dump.
The retained process stat is aggregate process state, not either worker's state.

The recovered preloads were also reviewed. Workers inherit the launch's `-r`
preloads by default: the module observer has a synchronous two-second file save
and the local-entry preload reads/registers the pinned manifest. These are
possible additional failure/delay sites, not demonstrated causes. No retained
worker exception or filesystem/scheduling observation attributes this timeout
to them. The main module observer records canonical compilation/instantiation;
it is not a worker liveness log.

## Focused evidence and limits

Command: `node scratch/runs/20261104-alice-desktop-timeout-cause/focused-desktop.cjs`.
Node v24.18.1 locally; original runtime was v24.22.1. No WAT compile, game media,
Alice route, remote allocation or heavy benchmark was executed.

`focused-results-run2.json` and empty `focused-stderr-run2.log` record exit0:

- Real authority plus two real bridges: hello, publish, snapshot ownership,
  scalar post, one-time poll delivery and2000 idle polls passed.
- Terminating the real authority produced ECONNECTION (about1.2ms); the caller
  closed and rejected the next call with ECLOSED.
- Terminating the bridge produced ETIMEDOUT (about3001ms); the caller closed
  and rejected the next call with ECLOSED.
- A small independent authority recorded execution of one destructive poll and
  withheld its response. The caller produced ETIMEDOUT (about3001ms), closed,
  and rejected another call. Shared counters proved one execution and an empty
  queue: there was no retry and no assertion that timeout meant non-execution.

These are injected failure controls, not a reproduction of Alice's cause.
The first local helper invocation failed before loading production code because
its relative require path was wrong; the original stderr is retained separately
as `focused-stderr.log`. Correcting that helper path produced the passing run.
The existing WAT/renderer integration fixture was not run: this bounded task
used small transport tests only while Stronghold held the heavy runtime lane.

## Next discriminating observation

Before another Alice execution, add bounded, run-specific request-phase and
worker-lifecycle observation. For each desktop request, retain a sequence ID,
operation, monotonic timestamp and markers for main submission, bridge receipt,
socket write, authority receipt, handler completion/queue removal, reply write,
bridge frame receipt and shared-buffer notification. For poll, retain requested
limit and queue counts before/after. Capture the response words at timeout.
Use worker-written separate logs or shared atomic markers, readable at timeout;
parent event callbacks alone cannot establish what happened while main blocks.
Do not log authentication tokens or treat observation as an acknowledgement.

Retain each worker's role, Node threadId/OS TID mapping, error stack and exit
code, with inherited preload identity. On timeout an external supervisor must
capture per-thread state/wchan/schedstat and process/cgroup CPU-throttling deltas
before normal cleanup removes the workers. Dead bridge plus its error identifies
a worker failure; a live bridge with authority receipt but no completion locates
authority execution; completion/reply without bridge receipt locates transport;
notification after the deadline with scheduling deltas establishes delay. These
observations distinguish the mechanisms the present timeout cannot distinguish.

Keep the first timeout and original pending command terminally unknown; no retry,
buffer reuse, timeout increase or swallowed error. A future runtime needs a
changed diagnostic setup and explicit coordinator `RUNTIME RELEASE Alice timeout`;
there is no authorization here to replay the unchanged route or resume oldbox.
No box was allocated or touched by this worker; Stronghold retains its runtime
and the coordinator retains shutdown ownership. This bounded diagnostic ends
with this missing observation, without a speculative production patch/full build.
