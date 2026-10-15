# IW current-lifecycle integration checkpoint

Base: `eb26d3a567d0a71ba6c1672afbebd82836d36d65`, fetched main on October 15.
The earlier held `e2d10ebb` chain forked at `4fde32fa`; it does **not** contain
the current loader lock or generation-aware unload implementation. Its note
about absent shared readiness describes that old branch, not current main.

The first checkpoint selectively ports the ten transport/frame/wait/generic
yield commits through `357727bab`. Main's native loader, reference counts,
generation pins, callback gate and terminal thread-exit behavior are preserved.
Broker cycle admission is unchanged. The loader commit `e2d10ebb` is excluded:
its conflicts in dll-loader.js and process-boot.js need semantic migration.
This is held integration work, not a main merge or game compatibility claim.

Two integration corrections were necessary even though the patches applied:
the old set_last_error export duplicates the existing export in 10-helpers.wat
and is removed; the scheduler fixture now requires ExitThread intent to remain
unsignaled until the Worker reports completed detach/exit, matching current main.

Passing source checks: actual Worker/local scoped generic yields, wait
reservations, frame ownership, wait identity, both wait repro tools, broker
ownership, scheduler (56 checks), browser cache graph, test-tier membership,
and diff whitespace. These use inspected tiny Wasm fixtures or JS mocks.

An accidental invocation of test-process-send-runtime.js attempted a **local
full source compile**, contrary to the source-only constraint. Validation failed
with duplicate export `set_last_error`, before instantiation or runtime.
The duplicate was removed; the native suite was not rerun. No generated build
file or ignored artifact appeared in this worktree; disk after the attempt was
2.4 GiB available. No Boat, browser, guest application or remote runtime ran.

Next: adapt scoped loading to main's beginDllLoad/endDllLoad generation pins,
nonblocking callback gate, finishDllInitialization/rollback contracts and native
completion transitions. Preserve the exact frame/epoch checks and separate host
publication receipt. Native two-Worker lifecycle and original-game validation
remain queued for an explicitly granted runtime slot.

## Loader migration boundaries found after the checkpoint

`e2d10ebb` was attempted on the isolated port and then aborted; none of that
loader patch is present in this checkpoint. Conflicts are not merely export
lists. Current main already owns the relevant native mechanisms:

* `loadDll` holds DLL_LOAD_LOCK before staging, uses an instance-owned row index,
  retains ROOTS or PINS on reuse, and waits for INITIALIZING by generation.
  `loadedModuleNamesLocked` reports only LIVE rows. The earlier audit of absent
  lock/count reservation was accurate only for the obsolete branch.
* `beginDllLoad` pins the captured provider generations across byte lookup;
  `endDllLoad` releases them. Capturing a bare set of names loses that ownership.
* `tryDllCallbackGate` is the nonblocking admission primitive. The async helper
  is not appropriate inside a synchronous scoped endpoint command. Busy must
  return pending without consuming the yield; successful admission must remain
  owned across host awaits, nested callback yields and initializer steps.
* `finishDllMain` calls native `complete_dll_initialize` for the original row
  generation. `finishDllInitialization` releases the mapping pin only when
  appropriate. The old scoped initializer invokes neither: pasting it in would
  leave a successful image INITIALIZING forever. FALSE, fault and terminal exit
  have distinct attached/failed/quarantine semantics that must survive the port.
* Yield 5 also represents FreeLibrary, FreeLibraryAndExitThread and deferred
  unload draining. The native `take_dll_unload_kind` is destructive. Its result
  must be captured once in the frame/epoch transaction before generic load-name
  lookup. A retry cannot take it again or turn an unload into LoadLibrary.
* Current stop/retirement drops local frames and terminates Workers. A newly
  retained callback gate or provider snapshot cannot simply live in a closure
  that disappears on termination. Actual retirement needs an ownership-checked
  release/abandon protocol that leaves incomplete image pins quarantined and
  cannot release a replacement thread's gate. This requires native/host identity
  review, not an unconditional atomic store from the host.
* Completion must preserve main's generation-bearing mapped/retired resource
  events (`registerMappedDll`, `isCurrentDllMapping`) as well as the held chain's
  separate host-publication receipt. The receipt alone is not native readiness.

This is a prerequisite port, **not** an implementation of these loader steps.
Yields 3/5 remain outside the owned service on this branch, as on `357727bab`.
No callback-loader success, cross-thread loader fix or runtime compatibility is
claimed. Existing source tests cannot discharge native lifecycle requirements.

## Prepared native readiness conformance

`test/test-dll-same-module-concurrent.js` now holds A before its actual x86
DllMain until B has inspected the INITIALIZING row. It removes the 300 ms
scheduling assumption and the misleading host flag set before DllMain ran.
Both independent native Workers must see the name absent while initializing
and present after TRUE; B's returned mapping must actually be LIVE in the native
lifecycle table. Same HMODULE, one mapping, same-owner reentry and native guest
LoadLibrary parking checks remain. This fixture has **only syntax/diff checks**
on the new branch; execution is queued. A worker failure must fail the suite,
not be treated as initialization success.

After an explicit sole-runtime grant and a matching canonical build, run:

```
node test/test-dll-same-module-concurrent.js
node test/test-dll-concurrent-mapping.js
node test/test-dll-lifecycle-races.js
node test/test-dll-worker-message-lifecycle.js
node test/test-dll-import-graph-lifecycle.js
node test/test-dll-terminal-lifecycle.js
node test/test-process-send-runtime.js
```

Those existing ordinary-loader tests are prerequisites. The next scoped port
also needs actual Worker/local tests with the native lifecycle ABI for two
owners racing one name, delayed lookup plus provider unload, same-thread nested
load/unload, FALSE/trap/terminal exit, lost mapping/publication replies and owner
retirement. Keep frame/epoch and generation checks simultaneously; tiny mapping
fixtures without the lifecycle ABI cannot establish this.
