# Original TIM Puzzle 2: direction gesture and supervisor blockers

The single fresh original run clears **Puzzle 1 with 654 bonus points**, then
ordinary Continue and Advance reach **Tutorial: Mirror Images**. A separately
clicked cage is anchored in the right enclosure. Clicking its body picks it
up again; clicking the visible direction handle then moves it into invalid
red-X placement instead of establishing a flip. **No Puzzle 2 basketball,
belt, Run, bowling-ball movement, basket consequence or clear is proved.**

Evidence: `scratch/runs/20261114-tim-puzzle2-direction-belt/result.json`.
Selected, actually viewed originals include `fresh-puzzle1-clear-bonus654.png`,
`native-puzzle2-instructions.png`, `native-puzzle2-fresh-board.png`,
`puzzle2-cage-floating.png`, `puzzle2-cage-anchored.png`,
`puzzle2-cage-selected.png`, `puzzle2-direction-click-invalid.png` and
`puzzle2-cage-dropped-handles.png`. Only selected PNGs, compact logs/JSON and
Git patches are retained; no review-frame series, source/media copies,
module dumps or bundles are retained.

## Preparation and the actual gesture boundary

Before launch, the prior construction note and its actual anchored/floating
cage images were read/viewed. Original manual printed pages 1, 12, 13, 14,
15 and 16 were viewed. Page 12 says to drag a part into place, left-click once
to place it, then click the desired handle; red arrows flip/change direction.
Page 13 describes separate attachment clicks at the two belt endpoints.
This supplied a prospective ordinary gesture, but **did not resolve how to
activate the direction handle through this input path**. The prelaunch claim
that the sequence was understood was too strong. No guessed password or state
import was used; the fresh Puzzle 1 reconstruction earns Advance.

Reusable helpers and their checks were prepared before launch. Each helper
submits exactly one explicitly chosen action bound to the current full native
frame, then returns the next full scene. There is no action list, queued future
input, autoplay, retry or script writing during the active session.

Review 27 drags the inventory cage from (600,224) to (464,126). Review 28 is
floating, with handles; a separate click at (464,126) produces review 29's
anchored cage without handles or red X. Review 29 clicks its body at (484,126).
Review 30 exposes handles, but this is a pickup, not proof of an anchored
selection ready for flipping. Its click at the visible red arrows (456,152)
produces review 31's displaced cage with a red X. **There is no direction
change.**

The pickup preserves the body offset: a restoration click at (464,126) leaves
the cage left of the enclosure and still invalid. Clicking (484,126) restores
the geometry inside the enclosure. Review 33 shows handles and a yellow hand
cursor without a red X. Its final anchored/handle-ready state is unqualified.
The attempted next direction click is refused because the native PID is
already absent; **there is no command-33.json**. No later frame or input is
claimed. The practical blocker remains distinguishing pickup from the
anchored smart-handle operation. A hover/press ordering explanation would be
a hypothesis, not an established generic defect.

## Termination: actual records differ from the initial interpretation

The initial commentary inferred an expired review. That inference is corrected:
there is **no runtime-error.json**, and the exit hook records **REVIEWING**,
failure null, held false, after 232.913 seconds. It runs approximately 24 ms
after review 33's capture, not after that frame's 28-second deadline.
The supervisor tool session, actually polled, returns **143**. Its normal
`session1-supervisor.json` child-wait/EOF completion record is absent; its log
ends at review 31 even though the child wrote reviews 32 and 33.

The termination source is unknown. No native Quit, review-timeout cause,
904-second deadline kill, actual native-child wait/both EOFs, or joined
watchdog close is claimed. This is an additional supervision evidence gap.
There is no replay, restart, active extension or second original session.
All four recorded runtime/supervisor/watchdog PIDs are subsequently absent,
and a nonblocking heavy-lock acquisition succeeds and is immediately released.
Absence and lock availability are observations, not substitute wait receipts.

## Identity, checks and limits

Launch pins main `043f96fdad495aecfb97a397be11fa521106bd39`.
All 105 runtime source hashes, compile helper pins, 15 media files and the exact
13-file installation match before/after. The accepted focused VGA/native
INT33 checks and locked full build are reused only on these exact pins.
There is no new full-build claim or production source edit. Seven new
controller/error checks pass: immutable lease, held drag, independent operation
UP, integrated controller, unchanged public cap, command binding/staleness and
caught-error metadata. Those fixtures do not prove native gameplay or this
supervisor's cancellation handling.

One immutable 900-second session follows the actual Hexen II and SuperTux
waits/EOFs. The 904-second supervisor and independent session watchdog are
armed; review is fixed at 28,000 ms under the unchanged public 30,000-ms cap.
The independent operation watchdog has an 8-second UP deadline and 1-second
kill grace. All 32 submitted operations have ARM/normal RELEASED records and
postrelease consequence metadata. Native callbacks show 31 mouse presses and
31 releases. Maximum submitted review age is 18.954 seconds. Review 33 has no
submitted command. Watchdog close/EOF records are missing on termination.

The actual early module and final exit metadata agree on SHA-256
`44dbe86c807add8ad8c1f8010ed455ab8b011d282f9387dfaf42481109710fa1`,
346,006 bytes. The exit hook records 2,417,044,210 dispatches and 1,068,248
handbacks. The fresh private overlay contains **one entry**,
`sierra/tim/tim.cfg`, length 4, SHA-256
`bef28849642bc5f0f208c33156297f4906512cbbf2943bcf1edf41c6821daed3`.
Native write-call count and timing are unknown. No operator guest/configuration,
physics, score or clock writes occur. Mounted media remains unchanged.

Free /home space remains above 1.5 GB. No box is created, resumed or deleted:
ID none, state NOT_CREATED, expiry null, stop receipt N/A. Foreign WIP is
preserved. This bounded task stops with the control blocker and missing
supervisor waits explicitly recorded. Any separately assigned follow-up needs
a qualified anchored smart-handle gesture and cancellation-resilient actual
wait records before another original runtime. Full 27 remains unproved.
