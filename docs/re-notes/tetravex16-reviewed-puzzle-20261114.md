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
The controller and tests were published before the original as
`aeca71687574839b4c719bfe3e13455993fb3c5c`.

The single original ran on 2026-11-15 UTC after the Tutstomb and Quake3
predecessors' actual native/watchdog/supervisor waits, EOF, release and PID
absence were reviewed. It used the default 3×3 puzzle, real ticks and the
default 1000-instruction batch setting, with a 1200-second native limit and
an independently prearmed 1220-second watchdog. The initial native window
already displayed the board; no Start action was needed. One complete
bootstrap/title/board review bound PID 14143, start token `274953602` and
HWND `0x10001` permanently. There was no second puzzle or rebinding.

Nine personally chosen drags completed the puzzle. Each choice followed a
fresh complete scene and a manual review of its visible numbers and occupied
neighbors. The table records those observations, in top/right/bottom/left
order; it is a report of completed actions, not an action queue.

| Drop | Source supply cell | Tray cell | Edges | Matching occupied neighbors |
|---|---|---|---|---|
| 1 | r2c1 | r1c1 | 8/6/4/6 | none yet |
| 2 | r1c1 | r1c2 | 6/9/4/6 | left 6 |
| 3 | r1c3 | r1c3 | 3/6/4/9 | left 9 |
| 4 | r2c2 | r2c1 | 4/1/5/3 | above 4 |
| 5 | r3c2 | r2c2 | 4/4/5/1 | above 4, left 1 |
| 6 | r3c1 | r2c3 | 4/9/6/4 | above 4, left 4 |
| 7 | r3c3 | r3c1 | 5/9/5/2 | above 5 |
| 8 | r1c2 | r3c2 | 5/5/4/9 | above 5, left 9 |
| 9 | r2c3 | r3c3 | 6/8/4/5 | above 6, left 5 |

Drops 1–8 have separate post-UP native persistence reviews: the source was
vacant, the tile stayed snapped in its chosen cell, and every occupied
adjacent edge matched. Seven of these have occupied matching neighbors.
The ninth drop immediately replaced the tray with the native yellow smiley
and stopped the timer at **10:19**. It therefore has native completion
evidence, rather than a fabricated ninth persistent-tile review beneath the
completion image. The completion image remained on a later complete capture.
All nine destination-UP receipts were acknowledged, with intent-to-UP times
between 0.478 and 1.212 seconds; independent release children all actually
waited with exit 0 and both EOFs.

Some local reviews expired before any input intent was created; they were
refreshed and personally reviewed again. One read-only fourth-placement
acceptance submission used different wording for the same neighbor, failed
the exact-neighbor assertion, and was corrected from its original review.
Neither case sent another game gesture. There was no original UNKNOWN,
illegal placement attempt, reset, new game, size change, Arrange, hint or
Solve action. No automated tile reader, solver or move generator was used.

After recording completion, the irreversible Quit phase opened the actual
Game menu and selected its visible **Exit** row. Native `[Exit] code=0`
followed. The final release child observed `OWNER_EXITED` with actual native
wait 0; it does **not** claim a physical UP acknowledgement after process
death. Native PID 14143, watchdog 14142 and supervisor 14140 have actual
wait 0, both EOFs, heavy release, absent PIDs and a closed control port.
The ancillary tool wrapper returned 143 and remains separate from those
actual child waits. This was native Exit, with no host-close fallback.

All 442 exact launch pins matched at postflight before releasing the runtime
slot. They include registered EXE/HLP/WEPUTIL, every existing WEP3 sibling,
known auto-import DLL candidates including MSVCRT, fonts, the system type
library, runtime sources and both built WASM hashes. Native startup logs
confirm WEPUTIL loading and eager mounting of the 15196-byte Help file.
No media was downloaded or substituted. Exact sizes/SHA-256 values and the
relevant shared uncommitted Git binary patch are retained in the run directory.

`result.json` names five selected raw complete PNGs: initial board,
four persistent placements, eight persistent placements, native completion
and the native Exit menu. Working capture PNGs were pruned after review;
their review metadata and original hashes remain, with the pruning inventory.
The run contains compact unique logs and no source-tree archive, media copy
or WASM copy. No box was created (ID/expiry null, state `NOT_CREATED`, stop
receipt not applicable). The runtime slot was released for the queued Win16
cursor worker; this bounded puzzle task is finished.
