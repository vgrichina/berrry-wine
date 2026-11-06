# Native WinHelp callback suspension, 2026-11-06

Reproduced and repaired in `scratch/runs/20261106-help-suspension/`. Baseline Git
`20af5aeca8434202b45186229e0be63ddc4385a2`, standard module `ab1ce417568573f42448f031ab6cb4d8c7db0d33adb7727ca97b7e3a5be3a692`,
compat `4b94ed4d8851472227a00debf7148f3d4bba12c8f362bdaf381b57488eee2bd2`.
The retained baseline modules reproduce with the final fixture too.

`test/test-winhelp-callback-suspension-native.js` reuses the real PE/DLL builder.
Its generated EXE calls public WinHelpA/W HELP_COMMAND/RegisterRoutine; the DLL
calls actual ReadFile on a ChunkCache-backed VFS file whose provider cannot
finish until the test resolves it. The eager control returns once with intact
registers, stdcall ESP and stack canary. On both baseline modules the lazy case
observes actual reason 12 and the owning pendingRead, then the wrapper erases
the yield, retires its child, frees arguments and reports caller success while
callback completion remains zero. Filling that exact read cannot revive it.
These are guest observations, not the AST ownership model.

Coordinator review also exposed the W epilogue: with the A repair alone, both
modules pass eager W but advance ESP by 20 while the W callback is parked,
then trap after exact provider resolution. `wide-before/` records real reason
12/pendingRead and the stack change. W now preserves the same public pending
return as A, and eager/lazy W are required in the native regression.

The repair retains an invocation-owned heap frame, arguments and architectural
CPU/wait state across the host park. Only the typed CACA0005 return with the
expected stack can complete it. Run validates live child/root/depth or actual
synchronous ancestry before resumption; completion restores the interrupted
context and finishes the original public stdcall once. Exhausting the existing
64-slice synchronous limit reports failure. Termination abandons frames without
reviving the caller. A validated replacement root discards the old frame head
without touching replacement heap storage; existing init_thread owns sync-pin
retirement. Main scheduler wait snapshots belong to the original exports/root
and preserve the absolute deadline rather than starting another full timeout.
No invocation primitive, recovery pump or document replacement policy changed.

Both shipped modules pass eager/lazy, nested public callbacks, owned-string
lifetime, exactly-once completion, GPR/ESP/canary restoration, an unrelated
thread's genuinely parked read, guest ExitThread, termination before provider
resolution, stale sibling/child/thread/process rejection, and explicit instance
reuse. A supplementary native macro interruption of actual guest Sleep(5000)
preserves deadline 5100 at clock 2500 (2600 remaining), exact registers/stack/EIP
and host wait-object identity. That interruption uses the existing macro export;
the primary suspension and nesting cases use public WinHelpA.

Locked full build, the existing seven-case native Edit/WinHelp suite and its
three rejecting controls on each module, 52 real ReadFile retry cases, WinHelp
ownership/resolver, ThreadManager, production PE/NE/init_thread lifecycle, JS COM
ownership, arena-spill and census mutation checks pass. One additional historical
extracted token harness cannot compile because its unchanged HEAD fixture omits
`$pending_seen`; exact unchanged source/test hashes and the preexisting failure
are recorded in `preexisting-token-harness.json`. It provides no qualification.
The actual shipped-module ownership negatives and lifecycle tests pass.

Initial missing-HLP setup, diagnostic assertion mistakes and intermediate repair
failures are retained in command logs. No source-tree archives, browser, boxes
or deployment were used. Git SHA plus relevant binary diff/new-file patches and
the exact modules/PEs/DLLs are retained. Win16, lazy HLP/CNT document staging,
browser/owning-Worker interruption and game compatibility remain unqualified;
lazy document loading is the separate next investigation.
