# Neverhood game-drawn Quit qualification

Implementation: `a853b016b` on main. Evidence:
`scratch/runs/20261117-neverhood-game-drawn-quit-room-action/result.json`.

The authentic Options screen draws Quit on the main game window, without a
native BUTTON child. The controller now admits an explicit personally reviewed
rectangle for that path, bound to the retained whole PNG/capture ID, native
process and actual window HWND/generation/process/thread. The native reviewed
context registry keeps that region immutable after binding and checks the
mouse point against it when consuming input. Ordinary native-button reviews
keep their existing validation. Owner/epoch/instance checks, native USER
consumption, independent prearmed physical release, real guest exit and actual
waits remain required. The 500/1750/3000 ms and 15/30 second limits are unchanged.

An authored x86 guest paints Quit itself through WM_PAINT/DrawTextA and exits
through its ordinary mouse UP handler. Retained-module tests passed native
USER consumption, independent UP and guest ExitProcess(0) with both EOFs and
actual waits. Wrong owner, stale region, cancellation, a genuinely delayed
650 ms HTTP reply, and incomplete exit settlement refuse completion and
preserve terminal UNKNOWN with zero later HTTP. An exited owner never becomes
a successful physical-UP acknowledgement. Controller/native-scene units and
the canonical locked build passed.

After publication and offline caller/admission/listener checks, the single
authorized authentic installed-shortcut run consumed Play and independently
released input. NHC was spawned, but its listener was not authenticated within
Play's original 3000 ms bound. The child logged `child observation: late/wrong
listener`; the controller latched `child observation UNKNOWN`. No child HTTP,
room action or Quit was attempted. All later work read local evidence only.
Host cancellation produced actual parent/child/helper/watchdog waits and both
EOFs; the outer supervisor recorded an empty remaining scope. This cleanup is
not authentic Quit, even though the launcher had called ExitProcess(0).

The unchanged 9fc startup and retained 5a417895 module/media/65-record/58-file
installation/WININIT/190-second proofs were reused by hash. Concurrent Sims
media-source changes were excluded through the prior sealed source inventory.
No further original is authorized by this task. Next work requires resolving
the cold child listener deadline with authored evidence before any newly
authorized original attempt.
