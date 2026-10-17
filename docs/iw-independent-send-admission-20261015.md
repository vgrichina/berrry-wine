# Independent process-send admission — source checkpoint

Task: `IW-INDEPENDENT-SEND-ADMISSION-20261015`, based on held
`dca0e6201b8320fae08294b9dad1856a63ffc14e` (including the validated retirement
ownership repair). This remains a held source change; no original Deus Ex: Invisible War,
full interpreter build, browser, remote runtime, or game qualification was run.

## Protocol

The broker resolves an HWND to its exact Worker link before assigning queue
ownership. Queues/stacks are keyed by that link object, within the registered
process generation. Resolution and dispatch revalidate process, window and link
lifetimes; the sender link accompanies each outgoing request. A replacement TID
cannot take an old link's queued callback.

An active callback publishes its frame token and send-wait epoch only after
the actual Worker reports yield 10. Message waits 7/15 use their existing owned
wait/scope epochs. A different chain may enter only through that published wait;
same-chain siblings remain excluded. The Worker verifies the exact top frame,
epoch and current yield atomically before snapshotting. Local-thread hops use
the same broker ownership when installed, so a local-to-foreign send does not
reuse the wrong thread's context.

Closing a wait disables admission and waits for already-admitted nested frames
to unwind. Host drive loops also retain a per-link stack and cannot resume or
abort an older frame while a newer driver is active. Send-wait resume carries
its epoch and uses the existing replay receipt for ambiguous acknowledgements.
Ordinary outgoing sends have a separate frame-zero wait token, and complete
only after incoming callback frames unwind. Known unavailable-target errors
set last-error through the owned completion rather than an unscoped export.

Both host and ThreadManager yield-17 scheduler gates now query their exact
link's pending sends. Readiness still wakes all lanes without polling.

## Review corrections after cd5ba2e13

Independent review found that a queued request could execute after its sender
Worker link stopped while the sender process remained alive. Requests now retain
that link, subscribe to its stop-start notification, and revalidate ownership
at queue pumping and immediately before adapter dispatch. Retirement rejects
the sender's result but leaves an already-executing receiver frame to unwind.
The actual Worker regression fails against the cd5 broker with a missing
expected rejection; the corrected broker never enters the queued callback.

Review also found that local sends newly routed through the broker could stall
when the receiver started in ordinary code. The host awaited the send while
its next scheduler step owned the only readiness notification. Pending sends
now pump eligible sibling threads through ThreadManager, and each receiving
thread publishes its own readiness at yields 7/15/17 before its scheduler can
clear that message point. Serial pumping remains serial. Actual round/serial
and free-run scheduler tests cover the transition from yield 0 to 17. Loading
the cd5 ThreadManager instead fails the bounded progress assertion.

Yield 10 needs a different ordering: the receiver's outgoing request must be
captured before an incoming callback can overwrite its send-argument globals.
Worker/local admission therefore defers an ordinary yield-10 receiver until
its frame-zero wait token exists. The test deliberately overwrites those globals
inside the incoming callback and checks the original outgoing result.

Once the awaited result settles, the send pump stops offering new slices and
drains already-posted ordinary slice promises. An unrelated sibling's complete
send continuation may remain pending because it can require the original
caller to resume. Such continuations retain their link's pending-send guard;
they cannot receive a second ordinary slice. A late continuation failure is
latched in ThreadManager and thrown by the next `runWorkerSlices` call. Actual
Worker tests hold an ordinary slice reply and separately reject a retained
sibling send to verify both boundaries.

Negative-control recipes (temporary source files must be removed afterward):

```
git show cd5ba2e13:lib/process-send-broker.js > /tmp/iw-broker-before-sender-retirement.js
WA_BROKER_SOURCE=/tmp/iw-broker-before-sender-retirement.js node test/test-process-send-admission.js --sender-link-only
git show cd5ba2e13:lib/thread-manager.js > lib/.iw-thread-manager-negative.js
WA_THREAD_MANAGER_SOURCE="$PWD/lib/.iw-thread-manager-negative.js" node test/test-process-send-admission.js --scheduler-only
```

Both commands using the previous sources must exit 1. The same commands without
the environment overrides pass. These tests are local tiny-ABI evidence only.

## Local evidence and recovery

### Receiver-link retirement correction (2026-10-15)

Final integration review of `f8598b086475fd28250726607bafea4fa2a9ffe8`
found that a deferred local send could wait forever after its receiver Worker
exited: the broker subscribed only to sender retirement, and the awaiting main
thread could not reach the next global readiness notification. Requests now
subscribe to the exact resolved receiver link. Retirement immediately rejects
queued requests with `receiver-gone`, removing their queue entries and both
lifetime subscriptions. The normal local-send path maps that rejection to
LRESULT 0 and LastError 1400; it does not fabricate a successful callback.

An in-flight adapter keeps its stack ownership. If its receipt says deferred,
retirement cancels instead of requeueing; an executing callback follows its
existing frame unwind and retirement path. Ownership is also checked before
dispatch and during queue pumping. Synchronous retirement subscriptions and
ordinary success both clean up listeners, including an already-retired sender.

The actual Node Worker test now drives main-to-TID2 deferred sends through
ThreadManager guest exit (yield 2) and actual Wasm trap, and drops an old link
after installing a same-TID replacement. Each completes without `notifyReady`,
checks LastError 1400, and leaves no pending queue/subscriptions. Additional
actual Worker cases call `process.exit(0)` or throw an uncaught error in a tiny
test wrapper around the production Worker. Node exit/error and browser error
handlers now start link retirement and reject outstanding transport requests;
they do not acknowledge scoped-loader retirement or release retained loader
pins/inventory. Further transport requests fail immediately. Active callback
controls separately cover explicit stop, raw exit, and raw error. Browser
handler behavior is source-reviewed only, not browser-runtime validated.

Further controls hold a real deferred receipt across retirement and retire a receiver
inside an active callback: the latter retains its frame and broker stack until
the pending operation returns. Pure broker controls cover three queued requests,
successful listener cleanup, and synchronous already-retired subscriptions.

All seven focused test scripts listed below plus the `--admission` reproduction
pass locally on Node v24.18.1. The old-broker negative control exits 1 with
`receiver retirement did not settle queued send`:

```
git show f8598b086475fd28250726607bafea4fa2a9ffe8:lib/process-send-broker.js > /tmp/iw-before-receiver-retirement.js
WA_BROKER_SOURCE=/tmp/iw-before-receiver-retirement.js node test/test-process-send-admission.js --receiver-link-only
```

This correction has no new native/full-module, original-game, browser or remote
runtime evidence. The native results in `iw-admission-native-20261015.md` predate
this correction and must not be represented as its validation.

Preparation incident: the initial cone sparse checkout pulled excess test
files and temporarily reduced free disk to 2,024,431,616 bytes, below the 2 GiB
floor. It was immediately replaced with explicit non-cone file globs, restoring
2,174,779,392 bytes free; later checks exceeded 2.20 GB. The floor was not
continuously maintained. Future sparse worktrees must set exact file globs
before the first checkout.

Run from this branch using Node; no binaries or dependencies must be built:

```
node test/test-process-send-broker.js
node test/test-process-send-admission.js
node test/test-thread-send-frame-ownership.js
node test/test-thread-send-wait-identity.js
node test/test-thread-send-wait-reservation.js
node test/test-thread-send-scoped-yields.js
node test/test-thread-send-scoped-loader.js
node tools/repro-process-send-cycle.js --admission
node tools/repro-process-send-cycle.js
```

All commands except the last pass. The last intentionally retains the original
adapter interface, with no destination links or explicit wait publication;
both original deadlock assertions still fail (exit 1). Its `--admission` arm
uses real Node Workers and the new interface; both progress assertions pass.

`test-process-send-admission.js` executes the actual `host.js` installation,
`GuestThreadHost`, `WorkerLink` and `guest-worker.js` with a small stateful Wasm
ABI. It checks independent A/B chains, local-thread-to-foreign nesting,
same-TID replacement, separate receiver-thread progress, register restoration,
early replies under nested callbacks (including an ordinary outgoing send),
lost resume acknowledgement, sender retirement, receiver retirement and outer
transport failure while a nested callback is active. Broker tests additionally
retire either endpoint while destination resolution is pending. Existing frame
controls now reject stale admission and missing/wrong send-wait epochs.

The wait-identity/reservation/scoped-yield/scoped-loader tests cover actual
Workers and local endpoints. Their loader suite also retains lost retirement
acks, generation-pin failure, scheduler inventory/stack retention through exit,
termination retry and failed-bootstrap ownership checks.

## Limits

The tiny ABI models callback state and protocol behavior, not x86 SendMessage
execution. Full native runtime, original-game behavior, pointer-message
marshalling and browser/cooperative integration remain unproved here. Existing
held lookup/alias/lifetime work remains held; this checkpoint does not authorize
merging that chain. The scheduler changes are exercised through real
ThreadManager methods and actual tiny-ABI Workers; no full guest scheduler/game progress
claim is made. A full test-tier census cannot run in the deliberately sparse
worktree; the new test uses the default unit-test filename convention.
