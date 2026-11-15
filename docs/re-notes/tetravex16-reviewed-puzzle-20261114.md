# Original WEP3 Tetravex, 2026-11-14

This bounded task concerns registered `wep16_tetravex`, selecting existing
`test/binaries/wep16/WEP3/TETRAVEX.EXE`. The community Visual Basic program in
`tetravex.md` is a different executable and supplies no native input authority.

The original NE module imports KERNEL, GDI, USER and WEPUTIL. Static native
input code captures the pointer at `1:2a78`, moves selected tiles through
`1:2b56`, and releases capture at `1:2c00`. This establishes a drag route;
it supplies no current tile values or move choices. The older JavaScript
Help text decoder produces damaged phrases, so its output is diagnostic
only. The built native Help decoder read all ten topics successfully. Topic 2
explicitly specifies dragging and rejects an illegal destination; topic 3
requires matching every neighbor. Topic 8 provides ordinary Game → Exit.
The actual current board is reviewed only in the single original run.

The controller accepts one manually reviewed gesture per complete scene,
with a permanent PID/start-token/window binding. Placement reviews expire
after five seconds; menu reviews after thirty seconds. Each drag has a
personally specified source, destination, visible edges, and every occupied
neighbor. An independent process arms UP before DOWN. Normal UP is sent to
the chosen destination; independent cleanup always follows even if that UP
fails. The total bound is 1500 ms, with a 1750 ms independent fallback.
There are no captures, model calls or audit writes while held. Any uncertain,
mixed, cancelled, late or identity-changing receipt closes input permanently.

A handler receipt does not establish legal placement. A separate personal
review must establish the source vacancy, persistent destination tile,
matching touching edges and native acceptance. Completion requires ordinary
native completion UI. The final 180 seconds are reserved irreversibly for
native Quit. No reset, second puzzle, shuffle, size change, hint or solve route
is admitted.

Evidence directory: `scratch/runs/20261114-tetravex16-reviewed-puzzle/`.
Qualification passed before the original: 25 policy tests, 11 HTTP controls,
12 actual CLI controls and the complete locked build. The CLI controls prove
native MOVE → DOWN → destination MOVE → destination UP order, the finite
release bound, native menu behavior, and refusal to turn a consumed gesture
into a native placement claim. Late acknowledgement, UNKNOWN, cancellation,
identity changes, child death, parent death, fallback and capture ordering are
covered. All 48 fixture native/watchdog/supervisor/outer waits have actual
pipe EOF evidence. The killed-parent release child retains a separate unknown
wait; its physical release effects are observed by the native fixture.

The initial HTTP late-response fixture mistakenly delayed every gesture edge;
its failed log is retained. The final fixture delays the intended DOWN only.
No original game was involved in that correction.

The full build uses the shared worktree, including the existing foreign file
size-table changes; relevant uncommitted runtime hunks are recorded as Git
binary patches with the launch pins. This is not a clean-HEAD closure claim.
No original runtime or completion claim yet at source publication.
