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
