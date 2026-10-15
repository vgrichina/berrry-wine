# Scoped lifecycle primitive checkpoint

Based on `8793e9f4722569602c59d523364b4bb86784d8af`, preserving the current
native lifecycle implementation. This checkpoint is not connected to the
callback transport yet and does not establish Invisible War compatibility.

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
The transport must still fence this operation by exact frame/epoch and link
generation, acknowledge cleanup before termination, and retain failed cleanup
state rather than releasing a replacement owner's gate.

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

Remaining: endpoint transport wiring, frame/epoch publication receipts,
generation-checked resource registration, stop/retirement acknowledgement and
lost-ack/timeout tests on actual guest-worker and local endpoints; then native
two-Worker lifecycle and original-game validation. No merge to main, Boat,
browser, full build, or native execution occurred in this checkpoint.
