# LMarbles Puzzle 2: twelve native slides, disk guard before move 13

Fresh native direct selection entered **Tier 1 Puzzle 2, Moves 28, Score 0**.
Twelve individually reviewed marble slides reached **Moves 16, Score 0**.
The formerly unsent upper-maroon Left is now earned. **CLEAR and next/tally
remain unproved**: the independent disk watchdog stopped the original before
the thirteenth arrow. There was no replay or recovery/dependency cleanup.

Evidence: `scratch/runs/20261113-lmarbles-1505/`. Full public frames
`puzzle2-hover.png`, `puzzle2-selector.png`, `puzzle2-board.png`, each
`selectNN.png`, and `move01.png` through `move12.png` were personally reviewed.
The native hover label, confirmation and ordinary Y reproduced direct
selection; no Tutorial clear was assumed or performed. The initial full board
and target matched parent `ce7b0b2ef`. Target colors were checked against actual
PNG pixels: red–maroon–yellow–maroon, with red above yellow.

`plan.py` plans only over a transcription of that public full frame. It has no
guest connection or input calls. Its 15-slide abstract solution and an
independent slide/target check are in `abstract-plan.json` and `plan-check.json`.
Every executed selection ring and settled move consequence was reviewed before
the next action. No automatic input chain, state/profile/configuration/clock
edits, or forced Present occurred.

Coordinates below use tile centers `(98 + 32*x, 154 + 32*y)` in the complete
1024×712 canvas. Rows increase downward. These are public-frame coordinates,
not guest memory addresses.

| Move | Color | From | To | Arrow | Native moves left |
| --- | --- | --- | --- | --- | --- |
| 1 | red | (8,7) | (8,1) | Up | 27 |
| 2 | maroon | (6,1) | (4,1) | Left | 26 |
| 3 | red | (8,1) | (5,1) | Left | 25 |
| 4 | yellow | (1,7) | (2,7) | Right | 24 |
| 5 | yellow | (2,7) | (2,4) | Up | 23 |
| 6 | maroon | (4,4) | (8,4) | Right | 22 |
| 7 | yellow | (2,4) | (7,4) | Right | 21 |
| 8 | maroon | (4,1) | (4,4) | Down | 20 |
| 9 | red | (3,1) | (4,1) | Right | 19 |
| 10 | red | (4,1) | (4,3) | Down | 18 |
| 11 | red | (4,3) | (3,3) | Left | 17 |
| 12 | yellow | (7,4) | (5,4) | Left | 16 |

The right maroon at (8,4) was selected and its ring reviewed in `select13.png`.
Its proposed Left to (6,4) was **KNOWN UNSENT**: `move13-refused.json` records
1,499,254,784 bytes free before any control subprocess or input for that arrow.
The remaining abstract moves are that maroon Left, red (5,1) Down to (5,3),
then red (3,3) Down to (3,4). Those consequences and native acceptance are
unproved; a future fresh run must review its own current board.

Launch followed Pawn1445's actual release and WebGL1500's successful final
candidate release. The WebGL changes to `lib/d3dim-gpu.js`, `lib/gpu-backend.js`
and `lib/d3d9-backend.js` were inspected before freezing. Under the heavy lock,
actual process argv inspection found no heavy child. The registered original
`lmarbles_108` launched once, using real ticks, cooperative execution, existing
86 original media plus CRT, and LIVE gzip logs. Fresh launch free space was
**1,525,948,416 bytes**. No boxes or workers were created.

Launch Git SHA: `5ddfd2b938b291764767bb9b785461f485c0e747`, plus the retained
exact binary diff and new test patch. Those concurrent WebGL changes were later
published by their owner as `8321c51729c4b46fced637ef4a51bbd645e1dc06`.
All 311 frozen runtime file hashes remained unchanged at postflight. Module
SHA-256 remained `6888cc5e4ec7693a8a317fe29147994c7f88fe43afe3109fe6ab0e3e349eec9f`.
All 87 existing media/CRT hashes and 72 parent evidence seals passed. Git plus
diff and owned new helper patches provide source recovery; no source/media
archives were made.

Two focused control checks passed (`test-cli-guarded-input.js` and
`test-control-server-step-progress.js`), as did four helper syntax checks,
the abstract-plan validation, and all 28 action logs. Each of 26 input pairs
had a separate UP process acknowledged before DOWN; release/control parents
actually waited with return code 0 and both streams at EOF.

Independent guard PID1104625 acknowledged before native PID1104626 existed,
then observed **1,499,693,056 bytes** free and sent SIGTERM. The original logged
orderly shutdown and exited **0**, with both gzip streams drained to EOF and
their full raw/decode hashes matching. Guard wait was 0 with both EOFs;
route-parent wait was 0 and outer session54592 completed 0. Native and guard
PIDs were independently absent afterward. `final.png` is the post-shutdown
desktop; `move12.png` is the final reviewed movement consequence. The board
watch session57507 completed with exit 143 after interruption.

No production code changed in this task; its commit contains only this note.
Box ID none, state NOT_CREATED, expiry null, stop receipt N/A. Next requires
sustained above-floor disk capacity for the remaining individually reviewed
native slides through an earned CLEAR and tally/continuation.
