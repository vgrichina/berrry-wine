# Original TIM Puzzle 1: scanout repair and incomplete native play

The preserved packed original reaches the actual editable Puzzle 1 board,
“PUT THE BALL IN THE HOOP.” A reviewed pickup/drop attempt leaves the ramp
inventory at three and no new part on the settled board. A subsequent short
held drag has delivered DOWN, held movement, independent UP and real execution
after release, but its next image is a transient empty board. Placement,
simulation, CLEAR and next puzzle are **not established**. The final session
reaches the matching control panel and times out without another input; the
later stale command is rejected locally. This is an incomplete gameplay result,
not proof of a native physics or placement defect.

Evidence is `scratch/runs/20261114-tim-puzzle1-solve/result.json`. Named key PNGs
include `fixed-editable-no-placement.png`, `short-drag-transient.png`,
`final-puzzle1-panel.png`, and `baseline-editable.png`. Raw pixels are retained;
no cropping, compositing or synthesized gameplay is used. The panel's miniature
machine preview, editable board, and running simulation are separate states.
Only the first two were observed. Lower-screen numbers are not score evidence.

## Generic VGA repair

Actual read-only video diagnostics show mode 12h, 640×480, four planes,
80 bytes per plane row, CRTC start 6400 (other transitions use 35840), and
line compare 367: CRTC 18h=6fh, 07h=1fh, 09h=00h. The predecessor renderer
ignores the line-compare address reset. Its bottom 112 rows exactly repeat the
top 112 rows; addressed plane-byte hashes corroborate the linear address path.

The [IBM VGA hardware reference](https://www.ardent-tool.com/docs/pdf/42G2193_PS2_Hardware_Interface_Technical_Reference_Video_Subsystems_Sep92.pdf),
September 1992, Video Subsystem printed page 2-75, describes the lower-screen
address reset after line compare. `dos.js` now decodes all ten compare bits and
expresses the boundary in rendered rows. `framebuffer.js` resets the planar row
address below that boundary. BIOS mode initialization disables the split beyond
the display. Both browser bundles are regenerated. There is no game-specific
pixel rule or guest register write in this repair.

Native reruns now show stored SCORE/BONUS graphics below the boundary instead
of the previous exact repetition. Residual bottom repetition and broader scanout
correctness remain unqualified. An empty upper board immediately after an action
is transient: ordinary further execution recovers the board. Do not interpret
that transient as lost game state or as a persistent blocker.

Five new generated-plane tests cover all compare bits, reset boundary,
nonzero start/stride, disabled defaults and planar mode X. They fail against
predecessor source and pass with the repair. Together with existing palette
coverage, 14 focused tests pass. Browser bundle loading, persistent input/session
controls, and run-local drag sequencing tests pass. These are implementation
and controller tests, not native gameplay fixtures. The full build passes under
both heavy-runtime and build locks; see `pipeline-results.json` and build logs.

## Original media and ordinary input

The 13 preserved installed files under `scratch/game-state/tim-20261114/C`,
original floppy `/dev/shm/wine-owner187-tim-disk.img`, and scanned manual
`scratch/media/tim-original-manual.pdf` are referenced by path and SHA-256.
All 15 hashes and the exact installed-file closure match after the runs.
The installed executable hash is
`34c844ba4586f27c817442ac5ed2f5b76e35d0c6521a9a9d4e7db66404e7c51c`.
No unpacked executable or solver state was loaded. Each startup uses a private
in-memory file overlay. No controller action writes guest configuration, scores,
physics or clock state. No native gravity or air-pressure choice was made.

The actual manual images were viewed: printed page 1 supplies fishbowl, cat,
and lightbulb; page 10 describes the panel green arrow; page 13 describes part
pickup/drop, the runner start button and left click to stop. Ordinary fresh
startup passed the manual prompts. No running simulation was entered.

Session 1 is nonqualifying: two commands incorrectly described expected screens
while the actual screen was still the title or a black transition. Its explicit
correction is `session1/review-corrections.json`. Sessions 2 and 5 time out at
the first review with zero input. Session 3 reaches the editable board before
the independent deadline kills its owner. Session 4 performs reviewed pickup
and drop, then waits to the unchanged settled board. Session 6 performs the
short held drag, releases and advances, then loses the next review. Session 7
accepts the manual answers and reaches the panel; review response timeout
prevents the planned longer held drag. It was never delivered. These timeouts
are controller interaction limits, not demonstrated guest faults.

Every native lease is immutable at 115 seconds, with an independent 119-second
outer deadline armed before launch. The response window is 28 seconds. No active
lease is extended. Heavy-lock queue time precedes launch. Every supervisor has
actual child wait and both stream EOFs; session 3's killed owner and reaped
watchdog are recorded. Postflight checks find no owned runtime/watchdog left.
No box was created, resumed or deleted: ID none, state NOT_CREATED, expiry none,
stop receipt not applicable. Disk remains above 1.5 GB.

The next useful work is a fresh, promptly reviewed native pickup/drop and settled
part-count check, followed by the runner and visible motion. The current result
cannot support a solve claim. Preserve the residual scanout issue as a separate
question until actual register/address evidence explains it.
