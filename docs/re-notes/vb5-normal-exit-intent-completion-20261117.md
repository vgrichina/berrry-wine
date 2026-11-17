# Reviewed intent completion at normal native process exit

Evidence: `scratch/runs/20261117-vb5-normal-exit-intent-completion/`.

The previous original remains permanently UNKNOWN and closed. No HTTP request,
rebind, replay, original launch, IDE launch or sample execution occurred in this
assignment. Its installed-output manifest and recovery inputs remain in
`scratch/runs/20261117-vb5-nested-owned-modal-install/`; this run records their
manifest identity without altering the installed output.

The controller previously admitted an actual wait only for an explicit Quit.
Other intents required another snapshot even when their native process had
already exited after consumed DOWN and independently acknowledged physical UP.
Requiring that snapshot races normal shutdown. Endpoint absence itself cannot
prove what happened.

The repaired completion contract retains the supervisor's PID, OS start token,
boot ID and fresh invocation token before DOWN, and checks actual pre-DOWN
liveness and the unchanged reviewed identity. The existing fresh-image,
owner/epoch/nonce, native control/focus checks and 500/1750/3000 ms deadlines
remain in force. A process-exited observation requires both an independently
published actual OS wait with status 0 and a matching native exit callback
receipt with guest status 0. The callback must occur after the independent
release process's physical-UP acknowledgement on the shared monotonic clock,
and before the actual wait. The UP timestamp is retained before joining that
process, so a fast legitimate exit need not remain alive through the join.

The native receipt is opt-in through `test/run.js --native-exit-receipt=PATH
--native-invocation-token=UUID`. It records the CLI's own OS identity and actual
native exit callback, rather than an application name, caption or inferred
success. It is published without overwriting an earlier record. An observed
signal or runner error publishes a separate irrevocable cancellation veto.
The supervisor marks forced cleanup waits separately from normal waits.

The extra native receipt is necessary: an authored x86 `ExitProcess(7)` really
produced CLI OS wait 0. A signal can likewise request orderly CLI shutdown with
OS status 0. Neither qualifies. Native error status, signal/cancellation veto,
crash, missing receipt/wait, pipe EOF alone, stale/reused identity, unrelated
wait, exit before UP, deadline expiry and late callbacks all refuse completion.
Transport loss while the retained process is still live immediately becomes
UNKNOWN. If a request races actual process retirement, the controller stops
HTTP and considers only the retained invocation's independent local evidence
within the original aggregate deadline. There is no connection-refused waiver.
UNKNOWN remains permanent, including for cleanup requests and late wait files.

The outcome is specifically **process-exited**, not proof of installation,
successful gameplay or another application-level effect. No post-exit screenshot
is required or claimed. A normal observed scene transition remains the existing
other completion path.

The focused suite exercises real native USER controls and x86 exits for install,
game and Quit, nonzero native exit, crash, pre-UP process termination, signal,
live endpoint closure, absent actual wait, unrelated PID/start token, late wait
and cancellation. Each native run has an independently prearmed fixed-deadline
watchdog. Native output uses closed regular files; native EOF is never invented.
Controller, supervisor and watchdog pipe EOFs and actual joins are recorded
separately. Real CPUWorkers execute the authored USER fixture through native
normal exit, nonzero exit, trap and USER retirement, then join their shutdown.
The retained-identity contract separately checks an unrelated live sibling and
never sends it a signal, including during cleanup; it exits naturally with 0.

Exact tested Git/source-patch/module identities, focused and regression results,
canonical flock build, publication and selected screenshot hashes are recorded
in `result.json`. Git plus the recorded binary diff recovers the tested source;
there is no source-tree archive. The next original task needs fresh authorization
and a fresh process/intent. This repair does not reopen or reinterpret the old
UNKNOWN attempt. No box was created; ID/expiry are null and stop is inapplicable.
