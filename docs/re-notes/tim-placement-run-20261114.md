# Original TIM: placed ramp and native Run/stop consequence

The genuine installed packed original reaches editable Puzzle 1, takes a ramp
from inventory, and ultimately leaves it fixed near (400,280), with inventory
reduced from three to two. The ordinary runner control then produces a native
simulation consequence: the unsupported blue ball at (32,240) disappears.
The manual's left-click stop restores that ball while retaining the placed
ramp. The basketball stays on its original conveyor. **No hoop contact,
CLEAR or next puzzle was observed.** This establishes placement followed by
Run/stop behavior, not a solved puzzle or a proved interaction between the
added ramp and a moving ball.

Evidence is `scratch/runs/20261114-tim-placement-run/result.json`. The selected
original PNGs are named there; no image was cropped, composited or synthesized.
`editable-inventory3.png`, `settled-ramp-inventory2.png`,
`native-run-blueball-absent.png` and `native-stop-reset-ramp-retained.png`
record the useful before/after states. `decoded-region-check.json` checks the
actual decoded PNG bytes: the basketball, two supported blue balls and hoop
regions are identical before Run, during Run and after stop; the unsupported
blue ball region changes during Run and exactly restores after stop. No
intermediate trajectory was sampled. Falling off the left edge is an inference
from its unsupported starting position, not a captured trajectory.

## Selection is not final placement

Fresh live reviews first show the original title, each ordinary printed-page-1
answer (fishbowl, cat, lightbulb), the Puzzle 1 panel, and the editable board.
The actual manual pages 1, 10 and 13 were viewed before launch. No gravity or
air-pressure option was changed.

The first held drag executes 10,001 real guest handbacks before moving from
the inventory to (360,180), then another 10,001 before release. Inventory drops
to two, but the ramp still has edit handles. An attempted short runner click
moves that selected ramp to the pointer: that attempt is **not Run** and the
earlier selected image is **not final placement**. This corrects the initial
live interpretation. `pickup-follows-pointer-not-placement.png` preserves it.
Short clicks at the desired board positions also leave it following the pointer.

A subsequent long press at the visible selected ramp's current (400,280)
position removes its handles. Review 15 shows the settled full board with the
unselected ramp. The next long press is at the runner (605,32); the ramp stays
at (400,280) despite that pointer movement, and the unsupported blue ball is
absent in reviews 16–19. The manual's stop press at empty (400,50) restores the
ball; review 22 shows the full reset board, the placed ramp, inventory two,
and the pointer away from the ramp. Thus the useful proof includes actual
selection, guest execution while held, release, anchored geometry, native Run
consequence, and native stop/reset. Longer press success does not by itself
prove a generic input defect in the shorter presses.

The original handler at 1D35:5D7F receives 23 actual callback invocations:
11 left presses, 11 releases, and one additional held movement. The movement
from virtual (2400,900) to (1440,720) retains BX=1; UP has AX=4/BX=0. The final
drop, runner and stop presses also execute that handler. Inputs use the public
LiveRun mouse API and existing INT33 delivery; no guest-memory writes, replay,
unpacked EXE, solver/configuration/score/physics/clock changes were used.

## Source, lease and checks

The task obeyed the source hold until the coordinator's 11:43:27Z SOURCE_READY.
The merged integration was a79e3b23f664bf3315d2eb725c2bdfb358a6d5f4; the actual
native launch pinned 162920439949708e192441578435ae2d597aa897 after a concurrent
documentation commit. All 105 toyvm source pins match after the run. The actual
toyvm module is SHA-256
`44dbe86c807add8ad8c1f8010ed455ab8b011d282f9387dfaf42481109710fa1`.
The host build's separate module and integration WIP are not substituted for
this runtime identity. No production source was edited by this task; the
inherited f95af58e5 VGA repair remains partial, not a full video/gameplay PASS.
Git SHAs, relevant binary diffs and patches for the new run-local controller
files are the recovery record; no source tree or media archive was made.

All 13 installed files under `scratch/game-state/tim-20261114/C`, the existing
floppy and scanned manual match all 15 before/after hashes and the exact file
closure. The installed executable remains SHA-256
`34c844ba4586f27c817442ac5ed2f5b76e35d0c6521a9a9d4e7db66404e7c51c`.
The fresh private writable overlay has zero writes.

One fresh **fixed 300-second** controller lease was used, as explicitly
authorized. A run-local derivation raises only the controller's fresh-lease
admission limit; production `controlled-input.js` is unchanged. The same
independent watchdog runs with its original immutable deadline. An independent
304-second supervisor is armed before child launch, with the heavy lock held.
The first live REVIEW_READY was consumed; each of 22 reviews binds the actual
frame digest, target, program, producer PID and fixed review deadline. Each
response stays inside the original 28-second review window. Gesture holds and
cadence are fixed before launch. No active deadline was extended and no UNKNOWN
operation was replayed. The guest executed 3,575,150,524 dispatches.

The controller stops normally at 283.035 seconds, status STOPPED, held=false,
failure=null. This is a controlled host stop after the native simulation stop,
not a claim of native process exit. The supervisor actually waits for exit 0
and both stream EOFs; the watchdog is joined and all three recorded owned PIDs
are absent. The heavy lock is released. No further session was launched.

Checks pass: 14 VGA line-compare/palette tests, actual native INT33 callback
regressions, pure controller lifetime/stale-review/independent-killer tests,
run-local drag sequencing and fresh-300/immutable-lease tests, and the full
`flock /tmp/wine-build.lock bash tools/build.sh` while also holding the heavy
lock. The test/build supervisor also exits 0 with actual wait and both EOFs.
Pure control tests are not original gameplay evidence.

No box was created, resumed or deleted: ID none, state NOT_CREATED, expiry none,
stop receipt N/A. Local owned processes are cleaned up; disk stays above 1.5 GB.
The remaining task is ordinary construction that moves the basketball from its
original conveyor into the hoop. This run does not identify an emulator blocker
to that solution and does not justify another source repair or automatic retry.
