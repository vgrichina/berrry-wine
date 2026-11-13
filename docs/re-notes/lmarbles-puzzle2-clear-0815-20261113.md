# LMarbles Puzzle 2 attempt after closed-API recovery

Puzzle 2 CLEAR and next/tally remain **unproved**. A fresh local native run
launched at **1,501,528,064 bytes** free on `/home`, after preparing both helpers.
The independent 1,200-second watchdog acknowledged and was observed alive before
native creation. Ordinary New Game and Start clicks reached the original
Tutorial board. The next intended ordinary level-selector click at (530,402)
was refused before input at **1,499,627,520 bytes**, **372,481 bytes short** of
strictly greater than 1,500,000,000. Direct Puzzle 2 selection therefore remains
untested. No marble moved; neither Tutorial replay nor the parent's red-up move
is counted as a new clear. No repeated floor checks, relaunch or cleanup followed.

Evidence: `scratch/runs/20261113-lmarbles-puzzle2-clear-0815/`.
Personally reviewed `initial.png`, `new-game.png`, `start.png` and `final.png`
preserve distinct menu, setup, initial fade and settled board observations.
The final full native board shows Tier 1 Puzzle 1, Moves 18, Score 0.
`level-two-refused.json` records the precise causal blocker. The earlier
5ea2b9372 Puzzle 2 consequence and 813ae7078 final Tutorial consequence were
personally reviewed at their original paths, hashed in `parent-review.json`.
The parent's UNKNOWN wait remains unchanged.

Normal host quit returned `quitting:true`, actual wait0 and both EOFs.
Native PID955887 and independent watchdog PID955886 each have separate actual
parent wait0 receipts with stdout/stderr EOF; both processes were absent in
postflight. The actual outer supervisor session7724 completed0. No deadline
fired. Box ID/state/expiry: none / NOT_CREATED / null; stop receipt N/A.

The registered `lmarbles_108` route reused unchanged current04 module
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`, real
ticks, cooperative threads, 1024×712 canvas and control port8430. All 86
original media references plus CRT passed full SHA checks before and after.
Exact launch Git SHA, command and path hashes are in `route.json`; relevant
source binary diff and owned helper/new-note patches are retained. No source
or media archive, state/profile/config/clock patch, forced call, automatic
input chain, RAM gate, protected-data change or production edit occurred.

Validation: helper syntax, all media/module identities, balanced menu clicks,
pre-input floor refusal, separate actual waits/EOFs, process absence and sealed
evidence reread. This documentation-only change requires no production build.
Next: sustainable authorized headroom through an entire run, then fresh guarded
ordinary level selection or Tutorial prerequisite and personally reviewed
Puzzle 2 moves through native CLEAR plus next/tally.
