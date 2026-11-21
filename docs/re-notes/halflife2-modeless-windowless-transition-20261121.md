# Half-Life 2: last-window teardown and windowless transition

Evidence: `scratch/runs/20261121-halflife2-lifetime/`.

`DestroyWindow` must not invent a quit when the last visible main window dies.
The native authored regression queues a next-page thread message, destroys the
first visible wizard window, retrieves the message and creates the second page.
Before the repair, the raw import-boundary trace shows quit flag 1 at destruction,
`GetMessageA` returns WM_QUIT instead of the queued message, and the guest calls
`ExitProcess(71)` without creating page two. After removing the synthetic flag
write from `destroy_main_window_lifecycle`, both windows are created and the
guest's final `PostQuitMessage` still produces flag 2 and ends `GetMessageA`.
`ExitProcess(0)` reaches the host. The separate control posts a genuine quit
before destroying the first window: that quit survives and prevents page two.
The existing modal-dialog and main-window recreation/focus regressions pass.
No capture/readiness guard changed.

Exactly one fresh original ran on the fixed module with sealed runtime sources,
an immutable empty overlay baseline, and bounded passive lifecycle observation.
Offline exact review/bind/intent schemas passed for all three planned inputs.
Complete Welcome, Internet Required and Steam Subscriber Agreement images were
personally inspected. The native agreement has 32,928 characters. Exact
`I &Agree >` acceptance received the native dispatch-return ACK and independent
physical UP.

The original then calls `EndDialog(0x1001d, 1)` and destroys the agreement frame
`0x1001c`. Raw trace sequence 110 records DestroyWindow on that frame; sequences
111–113 record main/focus zero and **quit flag zero**. There is no PostQuitMessage
or ExitProcess in the bounded original trace and no trace saturation. The next
capture readiness observation rejects the windowless interval with
`main.absentRequiresModal`, focus/actor/owner context failures. It no longer
reports `runtime.running`. That refusal permanently closes the scope; the adapter
then cleans up the owned native process. No subsequent endpoint requests or replay
occurred. No next dialog was observed before cleanup.

The generic lifetime defect is fixed; original advancement beyond the agreement,
installation and gameplay remain unproved. The retained original establishes
the windowless observation boundary, not whether the installer would subsequently
create a new window or terminate. Host cleanup is not guest termination. The old
original scope in `20261121-halflife2-native-install` was never queried or replayed.

Both locked builds and focused results are retained in the run, along with exact
Git/patch identities, the fixed original module, native logs and selected images.
An early fixed-test invocation ran before the first build finished and therefore
used the old build; its failure is retained under `after/` and is not counted as
fixed-module validation. Box ID/expiry/stop receipt are null; no box was created.
