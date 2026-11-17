# Original TIM Puzzle 2: native cage placement, Run still blocked

The fresh genuine original clears **Puzzle 1 with 653 bonus points**, then
ordinary Continue and Advance reach **Puzzle 2: Tutorial: Mirror Images**.
Its actual instructions and editable board are viewed before choosing a part.
A native held drag selects the mouse cage from inventory and moves it into the
right brick enclosure; a later ordinary click anchors it there. **Puzzle 2
flip, basketball placement, belt connection, Run, clear and next are unproved.**

Evidence: `scratch/runs/20261114-tim-puzzle2-construction/result.json`.
The selected original PNGs include `fresh-native-puzzle1-clear-bonus653.png`,
`native-puzzle2-mirror-images-instructions.png`,
`native-puzzle2-fresh-editable-board.png`,
`puzzle2-unsettled-cage-invalid-target.png` and
`native-puzzle2-cage-anchored.png`. These images were actually viewed. Only
selected originals and compact metadata/logs/Git patches are retained; there
is no retained review-frame series, source/media archive or module dump.

## What actually happened in Puzzle 2

The instructions require both bowling balls in the metal baskets, a placed
and flipped mouse cage, and a pulley belt connected to the conveyor. The
fresh board shows the fixed left basketball/cage/belt mechanism, an empty
right brick enclosure and opposing conveyors over two baskets. Inventory is
one basketball, one belt and one cage. The intended right mechanism mirrors
the left; this remains a prospective causal plan, not a tested solution.

Review 27 submits a held drag from the cage inventory at (600,224) to
(464,126). Review 28 shows the cage at approximately (464,112), still floating
with handles; the cage inventory is exhausted. The initial annotation called
it placed too early. Clicking the apparent direction handle at (456,152)
on review 28 instead moves the floating cage below the enclosure. Review 29
shows a red X and invalid placement. **This does not prove a flip.**

Review 29's ordinary click at (464,126) returns and anchors the cage inside
the right enclosure. Review 30 shows no red X or selection handles, and
basketball 1 / belt 1 still in inventory. It is the final native frame.
The operator then spent too long interpreting how to expose the direction
control. Review 30's fixed 28-second window expired. The attempted selection
at (484,126) was refused because the original PID had exited: there is no
`command-30.json`, no delivered selection and no later review. No connection
or Puzzle 2 Run was submitted. This is an operator review/control-handling
blocker, not an established emulator defect. UNKNOWN is terminal; no replay,
restart, active extension or second native session was attempted.

## Entry route and review limits

The actual prior clear images were viewed. The worker used ordinary fresh
Puzzle 1 reconstruction rather than an uncertain password transcription;
no guessed code or state import was used. Printed manual pages 1, 12, 13 and
16 were viewed. The three separately anchored motors, individually attached
belts and ramp follow the reviewed earlier recipe. The fresh native Run
produces the completion panel and visible basketball displacement beside the
funnel. The exact hoop-crossing instant is unsampled. This fresh 653 bonus is
separate from the historical runs, even though one earlier run also earned 653.

The newly authorized 60-second review window cannot be admitted by the
existing public controller: it hard-rejects frame ages above 30,000 ms. A
focused test confirms 60,000 rejection and 30,000 admission. The run therefore
sets its review window to an immutable 28,000 ms before launch. Permanent
ownership, release, frame freshness and UNKNOWN behavior are unchanged.
Reusable commands were prepared and tested before launch; each submits one
explicit current-frame action, with no action queue, autoplay or input retry.

One fixed **900-second** session is admitted after the already queued Q3 and
SuperTux actual waits/both EOFs. The independent session watchdog and
904-second supervisor are prearmed. The independent operation watchdog
acknowledges an immutable 8-second UP deadline before each DOWN, with a fixed
1-second kill grace. All 29 delivered operations receive normal release
acknowledgments; no fallback fires. Native callbacks show 28 mouse presses
and 28 releases. All 29 submitted reviews bind fresh frame/program/target
identity; maximum response is 15.678 seconds. Review 30 has no submitted
command. Its terminal control result is UNKNOWN, held=false, with failure
`review response timeout; no action` at 232.744 seconds.

## Identity, error metadata and cleanup

Launch pins main `50fb19134a8f4f7b9c0d21330deeadb380fd04c0`. All 105 runtime
source hashes and compile helper hashes match the prior accepted build and
focused VGA/native INT33 checks; their reuse is explicit. New lease,
public-cap, held-drag, independent operation-UP, full controller integration,
command binding/duplicate/staleness and caught-error metadata checks pass.
These are controller checks, not synthetic gameplay evidence. No production
source changes, generic fixes or fresh full build are claimed.

The actual fresh module is recorded immediately after compilation and again
on the error exit: SHA-256
`44dbe86c807add8ad8c1f8010ed455ab8b011d282f9387dfaf42481109710fa1`,
346,006 bytes. The final error metadata records controller state, registers,
2,209,412,343 dispatches, 978,411 handbacks and the actual overlay. It contains
**one native private-overlay entry**, `sierra/tim/tim.cfg`, length 4, SHA-256
`bef28849642bc5f0f208c33156297f4906512cbbf2943bcf1edf41c6821daed3`.
The number and timing of native write calls are not sampled. The operator supplies a fresh Map and makes
no guest/configuration/physics/clock/score/solver writes. This is not a zero
native-write claim. Unavailable success-return-only fields stay unknown.

Before/after pins match all 15 media files, the exact 13-file installed closure
and all 105 runtime sources. TIM.EXE remains SHA-256
`34c844ba4586f27c817442ac5ed2f5b76e35d0c6521a9a9d4e7db66404e7c51c`.
Current Git pins, relevant binary diffs, untracked-runtime patches and patches
of the new controller files provide recovery without a source archive.
Residual scanout remains unqualified.

The supervisor actually waits for child exit **1** and both stdout/stderr EOFs,
without deadline kill, and records no remaining owned children. Session and
operation watchdog closes are awaited. The four runtime/supervisor/watchdog
PIDs are absent and the heavy lock is released. The fair-turn waiter actually
returns 0. The messageboard watcher is stopped and waited during finalization.
No native Quit is claimed. Free /home space remains above 1.5 GB. No box is
created, resumed or deleted: ID none, state NOT_CREATED, expiry none, stop
receipt N/A.

The next separately assigned attempt needs verified ordinary pickup/place/
direction-handle handling before timely basketball placement, belt endpoints
and Run. This single task stops with genuine cage placement and a precise
operator blocker; it does not claim the requested Puzzle 2 mechanism or Run.
