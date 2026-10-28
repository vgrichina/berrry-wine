# Named-event entry reservation: blocked on the cross-process entry contract

No production repair or accepted candidate is supplied. Strict configured SSH
reconciliation returned `refs/heads/main` =
`98d132898c963790f797ef3d00c812964e413cab`, exactly the immutable donor. The
remaining gap is present in that revision. This task stops at the source-backed
contract incompatibility below; it does not replace the requested reservation
with a green authority model or a different deadline contract.

## Incompatibility

The required ownership must exist at Worker import entry, before an independent
process can acquire or reset the event. The available production interfaces do
not put that entry in the authority's synchronization domain:

* `lib/guest-rpc.js:119-136,847-866` captures the entry and publishes a digest and
  sequence in the calling process's RPC arena. No authority reference, generation,
  reservation ID, authority session or shared entry gate is carried there.
* `lib/guest-rpc.js:414-450` queues the RPC and blocks for the main broker. The
  broker validates the entry only when dispatched (`1019-1048`). The reservation
  word acknowledges a later reservation, rather than creating one at entry.
* The actual CLI adapter (`test/run.js:5183-5194`) forwards that entry to
  `ThreadManager.waitSingle`. The manager maps process-local handles to
  session-owned authority references (`lib/thread-manager.js:298-337`). Only
  `waitSingle`'s later validation and `registerWait` create its wait
  (`1689-1730`). A Worker import has neither this map nor its client's session.
* `lib/thread-manager.js:23-41,280-282` explicitly supports a socket authority
  inherited by other processes. The authority need not share the Worker's
  process or arena. `lib/guest-worker.js:567-582` passes no named-event
  reservation mapping or registration bridge into `createWorkerImports`.
* The provider's `events` and `waits` are private Maps in its server Worker
  (`lib/named-event-authority.js:163-179`). Its clients send JSON over a Unix
  socket (`306-317`), not shared arena references. Session-local reference IDs
  are resolved at `252-253`; wait IDs originate only at `260-262`. Set/Reset and
  acquisition consult only that private state (`269-280`).

Consequently an acquisition request arriving at the authority before registration
has exactly the same available event/reference state whether a different
process has entered its import or has not. The current contract gives the
provider no observation that distinguishes those histories. After it returns a
successful auto-reset acquisition to the other caller, later registration cannot
safely revoke that caller's result. A clock echo, digest, delayed registration,
or retrospective token therefore cannot close this interval.

A safe repair needs an explicit globally coordinated entry-linearization and
invocation/reference-lifetime contract across the socket participants, together
with guest/Worker initialization that installs it before those imports can run.
A process-local SAB reservation alone omits inherited-authority participants.
Opening a second Worker client without an atomic entry contract still leaves
its own request-delivery interval, and its session cannot use the manager's
reference directly. Speculatively reserving before a call would change unrelated
waiters' eligibility. No such cross-process entry ABI is available in the pinned
initialization/provider contract. This is a limitation of the available contract,
not a claim that implementing a new distributed protocol is intrinsically
impossible. This task does not invent or silently weaken that contract.

## Retained counterexample and limits

The unchanged requested historical test,
`test/test-named-event-worker-entry-boundary.js`, was attempted first. It exits
at line 13 because its old two-argument CLI source anchor no longer exists.
That is a fixture setup failure, not behavioral rejection or acceptance.

`named-event-entry-registration-20261028.cjs` is a new **blocker diagnostic**.
It loads complete production RPC, ThreadManager and authority modules without
source extraction or substituted modules. A real OS Worker invokes the production
`createWorkerImports` host import using a real manager-issued named-event handle.
The actual broker initializes its normal capability words, but dispatch is
intentionally withheld. A different process owns the authority; a separate
socket session opens the same named object.

Receipt of the actual RPC notification establishes causal import entry without
a diagnostic timestamp side channel. At that boundary the invocation sequence
is published and the reservation word is zero. The other socket session consumes
a subsequent signal. A subsequent Set/Reset pulse is also lost. After a bounded
90ms delay, validation of the exact transported 50ms entry and registration
returns `timed-out`, retaining the original budget. The positive control
registers a fresh wait, delivers a Set/Reset pulse, and observes its retained
`signaled` result while the contender cannot acquire it. All terminal results
are forgotten, references closed, Workers reaped, and the authority process
exits and removes its socket directory.

Normal diagnostic execution succeeds. `--require-entry-reservation` rejects at
`ENTRY_RESERVATION_REQUIRED`, with actual `true` versus required `false`; this
is an intentionally rejecting acceptance oracle, **not a mutation acceptance**.
No repaired candidate exists, so cancellation/reuse/error/mutation acceptance of
a new reservation lifetime was not run or claimed. The CLI adapter was traced
in source, not executed. The diagnostic does not qualify the complete CLI,
`guest-worker.js` initialization, guest execution, timestamp coincidence,
browser, original game or Windows behavior. No canonical module build or Boat
was used. The existing 32-pass/10-reject sealed groups are reused as historical
accepted evidence; their pins were not changed. The known identical sparse-stack
failure remains documented in the canonical Oct21 receipt and is not green.

## Recovery and handoff

Run from this task branch using Node24.18.1/libuv1.52.1, with its existing
qualified same-boot/time-namespace restrictions:

```
node --max-old-space-size=320 docs/reviews/named-event-entry-registration-20261028.cjs
node --max-old-space-size=320 docs/reviews/named-event-entry-registration-20261028.cjs --require-entry-reservation
```

The second command must reject; success would require review of changed inputs.
Use the owned guard and allocation from
`/tmp/named-event-entry-registration-repair-oct28/RECOVERY.md` rather than running
unguarded. Canonical external receipt:
`/tmp/named-event-entry-registration-repair-oct28/evidence/receipt.json`.
It binds input hashes, original failures, operation cleanup, exact report-only
commit/remote branch and measured resources. Root and donor files/metadata are
read-only; only the required append-only root messageboard was written.

Next production acceptance is **not justified** by this diagnostic. The next
substantive prerequisite is an implementable cross-process entry protocol and
initialization/ownership contract, then a real production-boundary repair and
its required rejecting controls. No replacement task or worker was selected.
