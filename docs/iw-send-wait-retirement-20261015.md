# Held callback waits: identity and retirement prerequisite

Historical prerequisite checkpoint at `855dfa3b8`. The held
[reservation follow-up](iw-send-wait-reservation-20261015.md) implements the
pending-result protocol; the two abort probes below now pass. The body retains
the identity fix's original evidence and its then-outstanding gap.

Based on `171918e659e689202fcf188f8ec09b11762a30ad`. This branch fixes the
identity used by the actual consuming callback resolver and rejects known-dead
links before consumption. **Frame/epoch reservation and pending-result delivery
are still unimplemented.** Do not merge this as an independent-cycle solution
or relax broker admission. Existing failure propagation and frame guards remain.

## A second destructive side effect, reproduced through the real driver

`GuestThreadHost._driveThreadSendToLink` creates a per-callback polling object
containing `waitPolls` and `waitStartedAt`, without `tid`.
`ThreadManager.resolveThreadSendYield` previously used `(state.tid || 0) + 1`
for non-main waits. Consequently, a callback running on Win32 TID 4 acquired
a real manager mutex as TID 1. TID 4 could not release it. Real
`terminateThread` abandoned mutexes for TID 4, leaving this mutex held by 1;
another thread received WAIT_TIMEOUT instead of WAIT_ABANDONED_0.

The small Wasm fixture is driven through the actual host dispatch loop and real
Worker. A resolver adapter supplies only its absent wait-handle metadata, then
calls the production resolver. The thread registry record is explicitly
installed in the test; this is not a full CreateThread/Win32 interpreter test.
Mutex acquire/release and termination bookkeeping are production methods.

The fix resolves the owner from the **exact WorkerLink object** in the manager's
live registry, or the backend's exact main/local link. It rejects unknown,
replaced, exited, stopped Worker, and stopped host targets before `resolveWait`.
The check and destructive `resolveWait` run synchronously on the host with no
intervening await. Caller-provided polling `tid` cannot override ownership.
Ordinary noncallback synchronization APIs retain their explicit thread-ID API.
The scheduler unit fixture now explicitly registers its mock as the main link;
the historical ownership reproducer likewise declares its actual fixture link.

This is a prerequisite, not a lifetime guarantee: the subsequent completion
await can still race nested frames, abort, termination, or lost replies. Exact
link identity rejects a replacement link object but does not introduce general
thread or sync-handle generations. Generic yields and custom callback resolvers
are not migrated by this change.

## Reproduction and remaining failures

```
node test/test-thread-send-wait-identity.js
node test/test-worker-thread-scheduler.js
node test/test-thread-send-frame-ownership.js
node test/test-process-send-broker.js
# All exit 0; scheduler reports 54 passed.

node tools/repro-thread-send-wait-retirement.js
# Exit 1: two post-consumption abort/state-preservation failures remain.
node tools/repro-thread-send-wait-ownership.js
# Exit 1: the original six frame/epoch/message-wait failures remain.
```

Before the production fix the new retirement probe reported eight failures:
wrong mutex owner, failed release, failed abandonment, two late completions
after abort, consumption after Worker stop, consumption after local-host stop,
and successful local resume after host stop. After the fix six assertions pass.
The passing test also checks unknown links, exited registry entries, a replaced
link with the same numeric TID, forged polling tid, and ordinary sync controls.
No test synthesizes a successful resolver or Worker completion.

Discriminating negative: a disposable Node module-loader override compiled
`git show 171918e659e689202fcf188f8ec09b11762a30ad:lib/thread-manager.js` in
place of that one module while running the new passing test. It failed all six
identity/pre-stop assertions; no worktree source was changed. The normal test
passed again. `node tools/test-tiers.js --check` passed (1842 files on this
held lineage), as did syntax and diff checks. An initial guessed
`tools/check-test-tiers.js` command did not exist; the actual checker above ran.

The two remaining abort failures pause transport after the **real resolver**
consumes an auto-reset event, call the actual frame-owned abort, then deliver
the original completion. Both Worker and local restore the caller to
`[ESP,EAX,EIP,yield,depth] = [101,103,100,111,0]`; late completion overwrites it
with `[113,0,0,0,0]`. The consumed signal is demonstrably absent from another
real zero-timeout wait. This is cancellation of a callback while its receiving
thread remains live, so thread-death abandonment cannot repair it.

The pre-stop cases stop the actual Worker/local host **before** asking the
resolver to consume. The baseline Worker consumed then failed posting to a
null worker; baseline local host consumed and returned `resume`. Both now
reject before consumption. This deliberately does not claim correctness of
retirement after resource consumption.

## Why the reservation implementation remains held

An acknowledged reservation must survive nested dispatch and out-of-order
unwind, with its result retained under an exact frame/wait epoch. The consuming
host must retain that result before any asynchronous delivery, retry the same
completion identity after ambiguous acknowledgements, and never re-run the
consuming resolver for it. Worker and local endpoints must distinguish:

- cancellation before consumption, which releases the reservation;
- pending consumed completion, which cannot be discarded by live-frame abort;
- delivery to the owning frame exactly once;
- actual thread retirement, including mutex abandonment by the registry owner.

Rejecting completion after the current abort loses the consumed result.
Rejecting abort alone leaks frames: `_abortThreadSendLink` currently ignores
its response, and callers still return/throw. Holding a reservation while
deferring all dispatch requires actual retry ownership: nested dispatch can
currently return `deferred` to a caller expecting a numeric result. Allowing
nested dispatch instead requires retained outer completion and an unwind-ready
notification before resuming the outer host driver. Ordinary slices and generic
export mutation must also honor reserved frames. These transitions need a
coordinated host-driver/Worker/local protocol; this patch does not substitute a
Worker-only stale-token check for that protocol.

No full VM, x86 wait execution, build, browser, Boat, download or game ran.
The two probes have infrastructure deadlines and use only a tiny Wasm fixture.
Both historical cycle/two-thread probes and full-VM scheduling remain held.
