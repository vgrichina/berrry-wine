# Original TIM Puzzle 1: native mouse-motor chain and completion

The genuine installed packed original displays **PUZZLE 1 COMPLETED!**, with
624 bonus points, after ordinary construction and Run. The basketball visibly
moves from its initial (272,64) position to approximately (347,64), then to
(458,165) beside the funnel while the completion panel is present. Clicking
Continue opens the native Replay/Advance choice. Puzzle 2 was not opened.
The exact rim-crossing instant was not sampled; completion is established by
the game's own panel, not inferred from a static construction image.

Evidence: `scratch/runs/20261114-tim-hoop-mechanism/result.json`.
The selected original PNGs `settled-machine-before-run.png`,
`native-basketball-moved.png`, `native-puzzle1-completed.png`,
`completed-bonus624.png` and `native-replay-advance-offer.png` were viewed.
No gameplay image was cropped, composited or synthesized, and no frame series
is retained. Manual page images are separately named renderings of the scan.

The actual scanned manual's printed pages 13 and 16 were viewed before launch.
Page 13 describes pickup/drop, belt endpoints, runner start and click-to-stop.
Page 16 illustrates falling balls triggering mouse motors, belts driving the
successive conveyors and a ramp beside the top conveyor. The live board's
inventory and geometry agree with that mechanism. No electrical outlet or
motor-toggle operation is needed for these mouse motors.

Fresh ordinary startup passes the printed-page-1 fishbowl/cat/lightbulb prompt
and opens the editable Puzzle 1 board. Three motors are picked from inventory,
positioned and separately clicked to anchor at (32,318), (160,264) and
(272,184). Each belt is picked up, clicked at its first pulley, then clicked
at the conveyor pulley. The three endpoint pairs are (68,314)–(130,296),
(196,266)–(242,216), and (308,186)–(322,88). Visible attached belt lines and
settled motor geometry are reviewed before Run. A ramp is anchored at
(352,96), directly beside the top conveyor exit. Inventory changes from
three of each part to zero motors, zero belts and two ramps. The runner at
(605,32) then produces visible ball movement and native completion. There is
no random ramp placement substituted for the power chain.

The mechanism's causal account comes from the manual and constructed
connections; the sampled images show all blue balls moved and the basketball
advanced. They do not individually isolate the time of every motor trigger.
Native completion ends the simulation. After Continue, the controller stops
at the Replay/Advance prompt; there is no separate manual stop click during
this successful simulation, nor a native application-exit claim.

Three annotation corrections are explicit in `review-corrections.json`.
The initial panel click at (515,365) leaves the panel unchanged; the next
review correctly clicks its green arrow at (65,108). Review 26 already shows
completion and the ball near (458,165); its wait-command annotation wrongly
anticipated a still-pending approach at (419,103). Review 28 is the Replay/
Advance prompt, not Puzzle 2 as its stop-command annotation anticipated.
Those latter operations are wait and host stop only. Neither supplied a blind
route or replayed input. The actual images and this corrected result control
the claims.

The native launch pins main `797f7cabf0649cea171aa34422a78b3d4a44a1e3` and
all 105 toyvm source hashes. The module is SHA-256
`44dbe86c807add8ad8c1f8010ed455ab8b011d282f9387dfaf42481109710fa1`, identical
to the predecessor's accepted module. All runtime sources and compile helpers
match its accepted exact-revision build and focused VGA/native INT33 checks;
`accepted-checks.json` records their reuse. Postflight matches all runtime
hashes despite concurrent unrelated main commits. No production source was
edited and no generic emulator defect is claimed. Residual scanout remains
unqualified. Git pins and relevant binary diffs, including new controller
patches, are the recovery record; no source/media archive was made.

All 13 installed files, the existing floppy and scanned manual match the
15 before/after SHA-256 pins and installed closure. The executable remains
`34c844ba4586f27c817442ac5ed2f5b76e35d0c6521a9a9d4e7db66404e7c51c`.
The fresh private overlay has zero writes. No unpacked EXE, solver, guest,
configuration, score, physics or clock writes were used.

One fresh fixed **600-second** lease was used. The run-local derivation changes
only fresh-lease admission; the production controller remains untouched.
The independent controller watchdog and a separate 604-second supervisor are
armed before runtime execution, with immutable operation/review bounds. Each
DOWN has independently prearmed UP; actual native callbacks show 24 presses
and 24 releases, plus held movements. Each action receives execution after
release. All 28 reviews are consumed within their original 28-second windows
(maximum response 15.834 seconds), including the first. No deadline is extended
and no UNKNOWN operation is replayed. The controller executes 2,675,275,007
dispatches and stops normally at 301.013 seconds: STOPPED, held=false,
failure=null. Pure lease/drag tests pass; they are controller evidence only.

The supervisor actually waits for exit 0 and both stdout/stderr EOFs, without
its deadline kill. The controller joins its watchdog. All three recorded owned
PIDs are absent, the heavy-runtime lock is released, and disk remains above
1.5 GB. No further runtime was started. No box was created, resumed or deleted:
ID none, state NOT_CREATED, expiry none, stop receipt N/A.

The requested native mechanism and clear are complete. The next optional
ordinary action is Advance on the preserved final prompt in a future fresh
session; this task ends without claiming that next puzzle was reached.
