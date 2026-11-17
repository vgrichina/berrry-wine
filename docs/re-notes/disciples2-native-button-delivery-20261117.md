# Native button delivery, 17 November 2026

Evidence: `scratch/runs/20261117-disciples2-native-button-delivery/`.

The authored real-ticks slow USER pump reproduces the missing-DOWN mechanism.
The renderer handler enqueues movement, hit-test and DOWN. The old guard reports
CONSUMED immediately on that handler's return. Independent release then purges
the still-undelivered tagged DOWN and queues UP. The guest's ordinary wndproc
sets its public title to `UP WITHOUT DOWN`. Movement coalescing is not needed
for this reproduction. No original endpoint was reused.

The repair keeps host application separate from native consumption. Production
CLI tickets remain DELIVERY_PENDING after the handler returns and acknowledge
CONSUMED only when the exact resulting edge returns through `check_input`.
Receipts explicitly identify `native-input-return`, retain host `appliedAt`,
and include the actual message metadata. This boundary does not assert guest
DispatchMessage/wndproc execution or a game consequence. The Disciples
controller refuses a host-handler receipt.

Release continues to cancel a pending edge and purge its queued effects before
issuing independent UP. It never preserves DOWN for delivery after UP. The
immutable wall/monotonic deadline, nonce tombstones and original release
references are unchanged. The post-handler public USER context is pinned until
native delivery, so target, focus, modal, generation or retirement changes
cancel the edge. The pre-handler reviewed context remains mandatory.

The authored normal and slow PE fixtures use the ordinary public message pump,
renderer, native module and actual Node guest Worker helper. Their input
consumer is the main VM. An ordinary GetTickCount loop under existing
`--real-ticks` makes the slow pump genuinely wait; Sleep alone would measure
scheduler batch time. Both positive fixtures show DOWN before independent UP
and the guest caption `UP after DOWN`. A separately armed process owns release.
Early release cancels without consumption and without a later DOWN. Production
guard plus actual renderer-queue units cover expiry, focus/target changes,
retirement, owner replacement, inspection/effect UNKNOWN, missing edges,
lookalike events and nonce replay. Current input-owner, reviewed-context,
independent-release and per-slot metadata tests pass.

The broader `test-input-consumption-state.js` extraction fixture fails with
`cliObservation is not defined` on both HEAD and the delivery patch. Its
baseline failure is retained and is not counted as a pass. Early experimental
cross-thread PE shapes that did not establish guest handling are retained as
failed experiments and are not qualification.

The canonical flock build passed. The material repair is published before
preparing the immutable native qualification and the single authorized fresh
original. Final runtime, route, selected screenshots and actual shutdown waits
will be recorded here and in the run result after those runs close.
