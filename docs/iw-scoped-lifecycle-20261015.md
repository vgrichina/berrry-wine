# Scoped callback lifecycle integration

Based on `8793e9f4722569602c59d523364b4bb86784d8af`, preserving the current
native lifecycle implementation. The first checkpoint, `622fa023d`, added the
primitive below. The subsequent integration connects it to the actual Worker
and local callback endpoints. No native or Invisible War compatibility result
is established by these source fixtures.

`ProcessBoot.beginScopedLibraryYield` admits yield 3/5 with the nonblocking
callback gate. Busy admission does not consume the unload intent or yield.
Admission captures `take_dll_unload_kind` once; load lookup owns a
`beginDllLoad` provider snapshot across byte acquisition. The caller supplies
bytes once with `prepare`, then advances one cooperative callback slice per
turn. Mapping and initialization reuse `completeLoadLibrarySteps`, including
native `complete_dll_initialize`, temporary references, failure rollback and
mapping-pin release. FreeLibrary, FreeLibraryAndExitThread and deferred drain
reuse the existing reservation/retirement generators. Results retain mapped
and retired generation-bearing events for later host publication.

Scoped DllMain uses the existing register/SEH continuation and native completion
path with stricter sentinel checks: an actual nontrapping halt 2 at EIP zero,
restored stdcall ESP and no yield. Traps at the sentinel cannot publish LIVE.
Ordinary loader compatibility behavior remains unchanged. Cooperative Sleep
consumes its notification once and advances the supplied guest clock.

Cancellation is an **endpoint operation before instance retirement**, not a
host-side recovery algorithm. It checks the same instance's native owner,
releases provider pins and gate depth, rolls back unstarted image ownership,
and leaves an active mapping quarantined or a detach group reserved. The
numeric native owner alone does not establish endpoint generation identity.
The transport now fences loader commands by exact frame/epoch and WorkerLink
lifetime identity. Local commands are bound to their owning host instance.
The Worker verifies that lifetime identity before admission or retirement;
the transaction also verifies the native callback owner before cleanup.

Validation performed without a full build/VM:

* `test/test-scoped-dll-lifecycle.js`: production JS locally and in a real Node
  Worker against a small explicit native-ABI simulation. Gate contention,
  snapshot pin, owner mismatch, TRUE/FALSE/trap/exit, mapping cancellation,
  nested gate depth, exact-once Sleep, all unload kinds, generation receipts
  and duplicate completion pass. This is not the actual guest-worker endpoint
  and does not execute x86.
* Three mutations fail as intended: omit native completion, omit provider-pin
  release, permit sentinel trap success. Exact source restored; suite passes.
* Existing `test-dllmain-load-context.js`, syntax, tier and whitespace checks
  pass.
* `test/test-scoped-dll-native.js` is prepared and syntax-checked only. It reads
  an existing canonical module, never builds, and executes synthetic x86
  attach/FreeLibrary/detach with native LIVE/FREE and generation assertions.
  Execution is queued for a separately granted runtime slot.

## Endpoint integration

Yields 3/5 now use `scopedThreadSendLoader`. Admission retains the operation
before host byte lookup; stale epochs reject and nested frames defer. Mapping
delivery is acknowledged before the callback driver advances the retained
transaction. Retries cannot map twice or consume unload intent twice. DllMain
waits, nested sends and nested loaders keep their own stack and gate depth.
Abort cannot discard a captured lookup operation.

A separate publication epoch retains mapped/retired events and thunk state.
Both CLI and browser use `publishScopedDlls`/`registerMappedDll`, checking native
generation before resource registration and preserving replacement-generation
resources on delayed retirement. Terminal unload publishes its retirement
events before the driver reports yield 2; it never resumes the exited caller.
Publication acknowledgement drops prepared byte buffers. A subsequent epoch
evicts completed same-frame receipts; driver exit clears the resolver map.

Worker stop rejects new commands and requests `retireScopedLoaders` on its
original lifetime identity. Retirement cancels transactions in reverse nesting
order and retains its acknowledgement for duplicate requests. Lost replies get
one retry; exhausted timeouts keep the Worker alive and return an error. A
later explicit stop retries that identity. Lookup pin cleanup failure keeps the
gate owned and can be retried after the invariant is restored. A callback or
generator cancellation exception is permanently retained: a closed generator
must not turn irreversible partial cleanup into successful acknowledgement.
Local stop applies the same transaction cleanup before dropping frames.

Dependency API-name inspection requires `guest_free`, attempts it exactly once
even if writes or API inspection throw, and preserves both errors if cleanup
also throws. A retained scope fault prevents duplicate allocation/free.

`test/test-thread-send-scoped-loader.js` runs actual `guest-worker.js`,
WorkerLink, local endpoint, host driver and ThreadManager against an inspected
tiny Wasm fixture with a simulated lifecycle ABI. It does not compile the full
source or execute x86. It passes nested/delayed/stale operations, missing
dependencies, native-completion transition calls, FALSE/trap/partial-map
quarantine, COM cleanup, all three unload intents, lost mapping/publication
replies, generation-bearing publication and owner retirement. Actual Worker
lost/duplicate retirement replies, timeout retention/retry, stale lifetime
rejection and failed pin cleanup are covered. Worker/local irreversible
generator failure remains a failure after metadata is restored; only the
deliberately poisoned test fixture is forcibly disposed with its private memory.

Endpoint negative controls fail when top-frame ownership, epoch comparison,
retirement acknowledgement, retained cancellation failure or inspection free
is removed. Exact source is restored after each mutation. Related scoped
yield/wait/frame suites, both wait reproductions, broker ownership, scheduler
(56 checks), browser cache graph, test tiers and syntax/whitespace pass.

Remaining validation: run the prepared native scoped test plus the native
same-module, concurrent mapping, lifecycle races, Worker message lifecycle,
import graph, terminal lifecycle and process-send runtime suites listed in
`iw-current-lifecycle-port-20261015.md` under a separately granted runtime slot.
Native two-Worker scoped races and original Invisible War still require runtime
evidence. No merge to main, Boat, browser, full build or native execution occurred.
