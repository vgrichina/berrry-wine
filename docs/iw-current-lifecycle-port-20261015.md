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
