# Held callback wait completion: consumption precedes ownership

Historical failure checkpoint at `171918e6`. The held
[reservation follow-up](iw-send-wait-reservation-20261015.md) implements the
protocol and migrates this probe to owned commands; its six assertions now pass.

Baseline: held `4888dded7dc8d0c063b94f91c7b7716ce64ed5aa`. This checkpoint
adds discriminating failure evidence, not production guards or a scheduler.

## Actual call chain and blocker

`GuestThreadHost._driveThreadSendToLink` passes blocked responses to
`_resolveThreadSendBlockedYield`, which invokes a custom resolver or
`ThreadManager.resolveThreadSendYield`. For yield 1, the latter synchronously
calls `resolveWait` before awaiting `link.completeWait`. `resolveWait` calls
`waitSingle`/`waitMultiple`: these consume auto-reset events and semaphore
counts or assign mutex ownership/recursion. These are mutations of shared
synchronization state, not a read-only readiness check. Only afterward does
`completeWait` reach the Worker to clear yield and rewrite EAX, ESP and EIP.
The local path has the same ordering.

A frame/epoch check in that Worker command alone would reject a completion
after the host had already consumed its resource. Reporting success would
silently lose it; reporting failure with the existing outer-abort behavior
would still lose it. A preflight ownership query races a newer callback
between the query and consumption. A per-process JS mutex cannot serialize
other Workers' accesses to the shared synchronization objects.

Yield 7 uses unowned `resumeThreadSendMessageWait`. Yield 16 and 8/9/12–15
use unowned `callExport('clear_yield')`; network and loader branches add further
mutations, including `vlan_pump`, async I/O fill, DLL loading and publication.
The custom callback resolver in `test-cross-thread-send.js` also invokes
ordinary `completeWait`. Ordinary scheduler callers of these Worker APIs must
retain their noncallback behavior; globally requiring callback tokens is not
a valid migration.

## Reproducer

```
node tools/repro-thread-send-wait-ownership.js
# Expected exit 1, six state-preservation assertions fail on this held branch.
node test/test-thread-send-frame-ownership.js
node test/test-process-send-broker.js
# Both expected exit 0.
```

The new probe uses actual `guest-worker.js`, `WorkerLink`, local host handlers,
and `ThreadManager.resolveThreadSendYield/resolveWait/waitSingle`. A controlled
transport barrier delays posting `completeWait` after the real resolver has
consumed a real manager-created auto-reset event. An independent real
`waitSingle(event, 0)` then returns WAIT_TIMEOUT, proving consumption before
completion. The probe admits a newer callback and releases that barrier.
The production completion overwrites its ESP (61→73), EAX (103→0), EIP
(42→4096) and yield (1→0). Both Worker and local variants reproduce this.

Two other assertions per variant fail: replaying a previous completion after
the fixture enters another wait on the same frame advances ESP again
(93→105) and clears the new yield; delayed outer message-wait resume advances
the nested wait ESP (61→65) and clears yield 7. No epoch exists in the current
protocol, so those old/new wait completions are indistinguishable. The fixture
explicitly enters the second wait with `set_yield_state`; this is a controlled
protocol replay, not claimed execution of a second x86 wait instruction.

The small Wasm fixture has real globals, stack-memory loads/stores, callback
depth and traps. It is shared with the passing frame-token test, which remains
safe to import without running its main. No Worker handler or resolver is
stubbed. The delayed transport wrapper forwards the original result to the
actual command. Every frame is manually unwound after measurement and the
Worker terminated; a five-second infrastructure deadline bounds the probe.
No full VM, guest interpreter build, browser, Boat or game ran. Syntax/diff
checks and the two passing controls succeeded.

## Required next interface, before changing admission

A solution must establish ownership of a particular frame **and wait epoch**
before destructive host resolution, then retain the exact completion until
that frame can accept it. The epoch must change whenever a frame leaves and
reenters a wait, even with identical handle/result/stack values. The Worker
must acknowledge an atomic reservation or equivalent lifetime guarantee;
read-then-act probes are insufficient. New callback admission, normal slices,
abort and retirement must respect that reservation.

Once a resource is consumed, its completion needs explicit pending/delivered/
retired state, an idempotency identity and acknowledgement rules for lost or
duplicate transport replies. Nested frames may delay delivery but must never
receive it. A consumed result must not be dropped on frame mismatch or blindly
retried (which would consume another resource). Cancellation before consumption
and retirement after consumption are different transitions. Auto-reset event
signals cannot simply be restored by writing 1 after arbitrary intervening
signals/waiters; mutex recursion/ownership and semaphore counts have distinct
rollback or abandonment obligations. Thread/link generations and ownership of
host-side resource reservations are therefore part of the same lifecycle.

Tests for that implementation must cover retirement/failure before and after
consumption, nested unwind ordering, duplicate/lost acknowledgements, epoch
reuse and resources consumed by other Workers. A narrowly added rejection
check is not that implementation. No partial production guard was added here;
frame tokens from the prior checkpoint remain useful but insufficient. Broker
independent-chain admission and the existing cycle/two-thread holds remain
unchanged.
