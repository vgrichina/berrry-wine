# Held callback wait reservation lifecycle

Follow-up to `855dfa3b8` on `task/iw-wait-reservation`. Object and message waits
now use an actual endpoint reservation protocol across the host driver,
Worker, local endpoint and ThreadManager. Existing frame guards, failure
propagation and exact-link identity fixes remain. Independent-chain broker
admission is unchanged. This branch remains held for review and real-VM tests.

## Ownership and delivery

The shared `ThreadSendWaits` endpoint helper assigns each observed callback
wait a monotonic epoch paired with its frame token. Another wait reached through
owned resume/run gets another epoch, even if its handle/register values match.
Missing and stale epochs cannot complete a new wait.

ThreadManager obtains an acknowledged reservation before calling the real,
destructive object-wait resolver. Only the top owning frame can create that
reservation. After the asynchronous acknowledgement it rechecks exact receiver
liveness. Consumption and recording its result are synchronous on the host;
the retained result is installed before awaiting completion transport.
Concurrent resolver calls share one in-flight operation. Lost reservation
replies consume nothing; lost completion replies retry the same retained value,
never the synchronization resolver.

The endpoint retains the payload and delivery phase on the owning frame.
Nested frames delay delivery until that exact frame is top again. Identical
duplicates acknowledge without another stack pop; conflicting payloads fail.
If nesting occurs after delivery but before resume, the driver preserves its
blocked response and waits for its own frame. Message readiness/resume is one
owned endpoint operation with the same epoch and duplicate acknowledgement.

Owned resume itself carries the consumed wait epoch. Its continuation response
is retained separately until acknowledged, so losing a resume reply cannot run
a newer wait or pop another frame. The link retries an ambiguous resume once
with the same identity; a subsequent retry can recover the retained response.
Repeated transport failure remains explicit, and the unacknowledged receipt
prevents cleanup from aborting the newer wait. Acknowledgement, progress through
a later epoch, or actual receiver retirement releases receipts. Lost housekeeping
acks retain the receipt and do not invalidate an already-received continuation.

## Cancellation, failure, fences and retirement

An unsatisfied object poll cancels its unconsumed reservation. Idle waits can
still be aborted. Reserved, consumed/delivered, and unacknowledged-resume waits
refuse live-frame abort explicitly; they cannot discard a consumed signal by
restoring the caller. Host cleanup reports refusal instead of ignoring it.
The owning resolver can cancel before consumption; it cannot cancel a retained
consumed result as though untouched.

Stop/TerminateThread before consumption prevents consumption. Actual receiver
retirement after consumption clears retained records and abandons mutexes by
the exact receiving thread identity. Already-consumed auto-reset signals and
semaphore units are not fabricated back into shared state. An exception with
uncertain resolver side effects marks the transaction faulted: no retry of
consumption, false cancellation, or silent abort; explicit owner retirement is
required. Tests inject failures before and after real consumption.

Ordinary Worker slices were already fenced by callback ownership. This change
also fences local main slices/main-yield resolution, unowned exports and other
mutating Worker commands while callback waits are live. It uses an **explicit
audited register/global read set**, not getter naming: `get_sleep_yielded`
clears state, `get_free_list` flushes heap bins, `get_edit_text` writes guest
memory, and `has_pending_message` pumps sockets. Those are blocked via unowned
`callExport` and `readExports`; message progress calls its readiness function
through the owned endpoint operation. Normal noncallback APIs keep their prior
behavior. Expected command errors target their sequence rather than rejecting
every unrelated request. The new helper is in both versioned browser graphs.

## Source-only verification

```
node test/test-thread-send-wait-reservation.js
node test/test-thread-send-wait-identity.js
node tools/repro-thread-send-wait-ownership.js
node tools/repro-thread-send-wait-retirement.js
node test/test-thread-send-frame-ownership.js
node test/test-process-send-broker.js
node test/test-worker-thread-scheduler.js
node test/test-browser-cooperative-budget.js
node tools/check-browser-cache-versions.js
node tools/test-tiers.js --check
```

All pass. The original six nesting/epoch/message assertions and two
abort-after-consumption assertions now pass through owned commands. The second
fixture wait is entered through actual resume/run, not an unowned setter.
The new suite covers lost reservation/completion/message/resume replies,
duplicate/concurrent delivery, conflicting payloads, actual driver nesting
between delivery and resume, cancellation, faults, and retirement. A separate
real Node Worker uses actual `ThreadManager.waitSingle` against the same shared
semaphore table and consumes only the remaining unit while the first result
stays queued. Only handle metadata is mirrored, not table state or results.
The fixture includes the actual destructive `get_sleep_yielded` body to verify
that denied getter-shaped calls do not clear state and ordinary calls still do.

Three disposable loader mutations target the actual helper in both endpoints:
removing top-frame deferral fails the nesting probe (`resume` versus `pending`);
removing duplicate acknowledgement fails lost-reply retry (ESP 93 to 105);
allowing reserved abort fails cancellation. Each negative exits 1; unmodified
tests pass again. All fixture code is committed source, so no ignored build or
external artifact is needed to reproduce it.

## Remaining holds

This is not an independent-cycle scheduler or complete process/thread-generation
protocol. Numeric-ID reuse across broader broker/cooperative lifetimes still
needs that proof. Generic loader/network/render/I/O callback yields are not
migrated to scoped exports here: unowned mutation while an outer wait is live
fails explicitly. Those nested scenarios require migration before admission
can be broadened. Full-VM cross-thread-send custom resolver calls are migrated
but syntax-checked only. No full VM, x86 wait execution, build, browser, game,
Boat or download ran. Browser cache checks verify source wiring, not runtime.
