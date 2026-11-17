# Fresh original Puzzle8 attempt: startup transport timeout, 2026-11-16

**Puzzle8 clear, tally, Puzzle9 and ordinary native Quit were not achieved.**
The single authorized original failed before setup and before any game input:
`Process desktop: ETIMEDOUT` in the desktop constructor's first `hello` call
(`lib/process-desktop.js:294`). The native harness actually exited1, with both
stdout/stderr pipe EOFs. This is a startup transport failure, not a demonstrated
LMarbles/SDL selection failure or an unsupported guest API. The cause is not
proved. No original restart, reset, endpoint replay or deadline extension occurred.
No original image was produced, and the game board was never reached.

Evidence: `scratch/runs/20261116-lmarbles-puzzle8-native-completion/result.json`.
The previous twenty-slide run remains historical incomplete gameplay, not a saved
checkpoint. Its endpoint was not contacted, and no old move route, solver output,
private board state or progress was imported.

## Prelaunch work and limits

The owned helper WIP adds a run-specific fixed 3600-second native limit,
independently prearmed 3620-second watchdog and irreversible 300-second ordinary
Quit reserve, checked before captures and intentions. Historical 180-second
fixtures retain their policy; historical deadlines and evidence were not changed.
The new policy checks 500ms confirmation, independent physical UP within1750ms,
3000ms observation, and explicit game/menu freshness of five/thirty seconds.
All budgets were recorded before this original. Its watchdog armed before the
native child; cutoff/deadline remained immutable throughout its brief lifetime.

The exact 86-file SHA inventory, authentic CRT and seven manifest corruption
controls passed. Production SDL selection code and the exact-file verifier match
published `4a8331cf9`; neither media nor those producer files was edited. The
complete CRT hash is
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.
The earlier first-selection prose omitted `dfcb`; the actual verifier and file
have the complete hash.

Authentic native SDL selection, eleven existing reserve/process tests, five new
budget tests and an actual native controller fixture passed. The latter observes
finite DOWN, independent UP, capture-triggered irreversible Quit cutoff and
actual native/watchdog/supervisor waits. These are synthetic qualification claims,
not original gameplay. After the new Git module was compiled, both the exact
SDL fixture and the strict native controller passed again on that module.
The controller fixture uses Solitaire without guest threads; it did not qualify
this original's startup path.

One first budget-test assertion incorrectly allowed only200ms for watchdog
startup. Failure also exposed inadequate cleanup in the new test: its temporary
output disappeared while its child chain remained alive. The corrected test
always requests fixture shutdown in `finally` and checks ordering instead of
assuming startup duration. The failed chain was closed; all five known PIDs are
absent. Its lost watchdog parent wait remains UNKNOWN, separate from the fresh
successful fixture's complete actual waits. Both failures remain in evidence.

## Exact runtime and closure

GL retained ownership of shared build outputs. No shared build/output mutation
was performed. To avoid coupling gameplay to that queue, published Git tree
`6f6289091fdfeab5de8868b9d2d60506386a6af1` was compiled directly through canonical
`compileClosure` plus its layout stamp into a sealed transient memfd. Module
SHA-256 is
`61a7d750c83c62ecbbe6e2388136d6a34d152f5782cb58b0338aea2a8528cc2b`.
Runtime source and module were resealed into the native child's own descriptors;
the source holder also retained its own descriptors until explicit normal closure.
Recovery is Git plus recorded owned binary patches and the compile recipe.
No source archive, module dump, cloned tree, copied media or foreign WIP was used.

The original used registered `lmarbles_108`, real ticks, guest-thread launch mode,
1024x712 and its own port45881/PIDs. Normal/Original/Puzzle8 selection was intended
but never observed; initial Moves96 and guest Workers1+2 were not observed in this
new run. The constructor authority-ready phase returned before its `hello` call
timed out. A first capture found the already-waited native terminal and latched
sticky failure without sending an endpoint request. No consumer was bound.
The full transient Git pool's startup cost is only a possible contributor;
there is no causal trace or reproduction proving it, and no timeout was relaxed.

Native child3415181 actually waited1 at10:13:49.041 UTC. Watchdog3415180 waited0
through its `actual-native-wait` path without signals. Supervisor and outer-child
waits are0 with both pipe EOFs; the invoking durable-wait tool also returned0.
The Git source/module holder closed its descriptors normally and its tool waited0.
All recorded task PIDs/groups were checked absent and port45881 closed. No box
was created: ID null, state NOT_CREATED, expiry null, stop receipt N/A.

## Publication and next work

Only this report is committed. The unqualified controller/supervisor/test WIP
stays uncommitted in the shared tree, with recovery patches and exact source pins
in the run. The helper full-build queue was explicitly canceled after the genuine
startup failure; no helper full-build or code-publication claim is made. Shared
build outputs remain GL-owned. Source/runtime ownership is released at closure.

A successor needs to qualify the exact threaded startup and source closure under
the unchanged transport limits before a separately authorized original attempt.
This assignment stops at the concrete first startup failure, with the completion
goal explicitly incomplete.
