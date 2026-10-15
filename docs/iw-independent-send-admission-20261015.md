# Independent process-send admission — source checkpoint

Task: `IW-INDEPENDENT-SEND-ADMISSION-20261015`, based on held
`dca0e6201b8320fae08294b9dad1856a63ffc14e` (including the validated retirement
ownership repair). This remains a held source change; no original Icewind Dale,
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
merging that chain. The scheduler gate change is exercised through per-link
pending assertions and source audit; no full guest scheduler/game progress
claim is made. A full test-tier census cannot run in the deliberately sparse
worktree; the new test uses the default unit-test filename convention.
