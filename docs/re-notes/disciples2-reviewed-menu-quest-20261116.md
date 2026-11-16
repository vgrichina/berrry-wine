# Disciples II reviewed-menu quest attempt, November 16

Evidence: `scratch/runs/20261116-disciples2-reviewed-menu-quest-progress/`.
The single authorized fresh original reached a fully painted native main menu,
but its one reviewed-scene binding refused with `reviewed native paint changed`
(`ok:false`, `timedOut:false`). No consumer owner was returned and no original
game input was sent. NewQuest, movement, town/turn/combat consequence, and native
Quit were not reached. This is an input-admission blocker; no emulator defect
or cause of the changing paint is established.

The predecessor explicitly released its helpers at 10:37:16Z. This worker
adopted their ownership and made no production helper or emulator changes.
Unlike the predecessor's black-startup review, this attempt passively observed
ordinary gray startup, the Loading screen, and the black transition, then
personally reviewed the complete main menu before the single bind. The selected
`original/mainmenu01.png` shows Single Player, Multiplayer, Options, Intro,
Credits, and Quit. The review was recorded 4.806 seconds after capture began.
The reviewed tuple was native PID 3455081, the installed original `discipl2.exe`,
USER hwnd `0x10001`, generation 1, process 1000/thread 1, matching live focus,
capture/modal zero, physical UP, and a 1024×712 host scene. The refusal was not
followed by another capture, endpoint request, rebind, replay, or second original.

Runtime and compiler inputs came from published Git
`68543c27cc4173b085205216c3e2979179f9140f`, sealed in memory, excluding foreign
uncommitted changes. The privately compiled canonical module SHA-256 is
`83703369cc49c3e16077a4abd43def27262487f83dd52583d1b433adf7095f5f`.
Shared build outputs were neither read nor written. Git, source hash metadata,
and patches for this worker's new orchestration inputs provide recovery;
no source archive, media copy, or Wasm dump was retained.

All 128 original media hashes and the 127-row support manifest passed preflight
and the focused post-run test. The EXE SHA-256 remains
`adba242a0a3563651baffa6ec7d9a6c0978b7ae844a1cccedb2a1f4e8eb7b1f8`.
The five original DLLs resolved. The missing physical OLE32 warning remains
explicit: CoInitialize, CoUninitialize, and CoCreateInstance use the existing
native emulator handlers. No unrelated OLE32 image or imported save was used.

Before the original, the same sealed module and Git runtime passed the public
native Solitaire controller fixture: permanent current-scene binding, finite
DOWN, confirmation 6.547 ms, independent physical UP 214.398 ms, and bounded
complete observations. Native, watchdog, parent, and fixture actual waits all
exited zero with both pipe EOFs. An earlier synthetic setup checked socket
ownership before its listener existed and failed before binding or input; its
cleanup request was unresolved, then local cancellation was used. Its native
and watchdog waits completed zero with both EOFs, but its parent-wait receipt
is missing. The failed fixture's endpoint was never reused.

The original's immutable 1,200-second deadline, independent 1,220-second
watchdog, and irreversible 180-second Quit reserve were armed before launch.
Original observations stayed within 3,000 ms. The unchanged controller limits
were 500 ms confirmation and 1,750 ms physical UP, with 30-second menu and
5-second gameplay review requirements. No gameplay input exercised those
bounds in the original. No solver, OCR, private game reads, input queue,
artificial clock/configuration/EXE changes, or historical endpoint was used.

After the refusal, a local cancellation file requested owned host cleanup,
distinct from native Quit. Actual original and watchdog waits exited zero with
both pipe EOFs; the supervisor recorded completion. The outer invoking tool
and module-holder invoking tool each exited 143. Separate normal outer-parent
and holder-close receipts are unavailable and are not claimed. Recorded runtime
PIDs, process groups, ports, and sealed descriptor paths were checked absent.
No box was created: ID and expiry are null, state NOT_CREATED, stop receipt
not applicable. No full build is claimed by this documentation-only change.

The next work is a bounded native reviewed-paint binding investigation using
generated/public fixtures and the retained refusal evidence. Any further
original requires separate authorization. Existing identity/freshness guards
must remain intact; this run does not authorize another original or endpoint
retry.
