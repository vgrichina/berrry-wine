# LMarbles Original Puzzle 5: actual Workers, clear, Puzzle 6 and Quit

Fresh registered `lmarbles_108`, **Normal / Original / Michael**, cleared
**Tier 1 Puzzle 5 after 25 individually reviewed slides**. Native completion
particles appeared at **Moves 13**. The native tally showed **Total Score
1650**, **Level Bonus 0**, **Move Bonus 0**. Ordinary Enter advanced to
**Tier 1 Puzzle 6, Moves 32, Score 1650**. Completion is established by these
native transitions; no literal CLEAR caption was observed or inferred.

Evidence: `scratch/runs/20261114-lmarbles-worker-puzzle5/result.json`.
Only nine selected, personally inspected result captures remain:

- `selector-hover.png`: actual fifth gold selector, Tier 1 Puzzle 5 caption;
  fresh Tutorial Score 0.
- `selector-confirm.png`: native confirmation names level 5 of chapter 1,
  from current level 1 of chapter 1.
- `board.png`: fresh Puzzle 5, Moves 38, Score 0.
- `before-final.png`: Moves 14; selected brown (1,4), red (5,4), green
  (5,3)/(5,5), brown (6,4).
- `clear-animation.png`: native completion particles, Moves 13.
- `tally.png`: Total Score 1650, both bonus counters zero.
- `next.png`: Puzzle 6, Moves 32, Score 1650.
- `quit-confirm.png`: native quit confirmation.
- `quit-menu.png`: full main menu, actual Quit highlighted white.

New Game visibly retained Normal/Original/Michael. Start entered the fresh
Tutorial at Score 0; the fifth gold selector was hovered, reviewed, clicked
and confirmed with Y. No earlier profile, save, score or board was imported.
This fresh 1650 tally is distinct from Puzzle 4's 1600 and Puzzle 3's 1550.

`native.stdout.log` establishes actual guest Workers 1 and 2: each instantiated
with 2313 exports and 294 brokered imports, received register/stack
initialization, and was reported as **spawned WORKER thread**, slots 1/2,
handles `0xe1000`/`0xe1001`. The CLI main guest remains local. The flag alone
is not the evidence. Both Workers logged `unexpected message writerRegistered`
before successful instantiation. There was no gameplay fallback or failure.

Launch source commit: `11029c55c5d649e4f4cd792cb0f28839d70d82e8`, plus
`runtime-dirty.patch` and `runtime-new.patch`. All **315 runtime/source/module
pins** matched through postflight. Loaded module SHA-256:
`c7f5bada4da4b4ed95b235add0aa1c9843176805d29d5b1ee79359752a19d348`.
All **87 original media/CRT pins** matched before and after gameplay. The EXE
remained at `test/binaries/candidates/lmarbles-108/game/LMARBLES/lmarbles.exe`,
SHA-256 `574df6673f136d399ab16afc145ca1ebf2589772884f2f47ce18c016f0fa40c5`.
The registered manifest and `C:\LMARBLES` working directory were used in place.
No media was copied or restored. Runtime used real ticks and a 1024×712 canvas.
Git plus binary patches preserve source identity without source archives or
module dumps. No production change was needed.

Tile centers are `(114+32*x,154+32*y)`, derived from the reviewed board.
An offline search over a manual transcription proposed the route below. It
had no guest/process access or input delivery. Every selected marble and every
settled consequence was personally reviewed before dependent input. No guest
board, score, configuration, clock or physics was written.

| Slide | Color | From → To | Arrow | Moves left |
| --- | --- | --- | --- | --- |
| 1 | green | (1,1) → (1,2) | Down | 37 |
| 2 | brown | (1,7) → (7,7) | Right | 36 |
| 3 | green | (1,2) → (3,2) | Right | 35 |
| 4 | green | (3,2) → (3,7) | Down | 34 |
| 5 | brown | (7,7) → (4,7) | Left | 33 |
| 6 | green | (7,6) → (7,7) | Down | 32 |
| 7 | green | (7,7) → (5,7) | Left | 31 |
| 8 | brown | (4,7) → (4,6) | Up | 30 |
| 9 | green | (3,7) → (4,7) | Right | 29 |
| 10 | green | (5,7) → (5,3) | Up | 28 |
| 11 | red | (1,5) → (1,4) | Up | 27 |
| 12 | red | (1,4) → (7,4) | Right | 26 |
| 13 | brown | (4,6) → (5,6) | Right | 25 |
| 14 | brown | (5,6) → (5,4) | Up | 24 |
| 15 | green | (4,7) → (4,6) | Up | 23 |
| 16 | green | (4,6) → (5,6) | Right | 22 |
| 17 | green | (5,6) → (5,5) | Up | 21 |
| 18 | brown | (5,1) → (7,1) | Right | 20 |
| 19 | brown | (7,1) → (7,2) | Down | 19 |
| 20 | brown | (5,4) → (1,4) | Left | 18 |
| 21 | brown | (7,2) → (6,2) | Left | 17 |
| 22 | red | (7,4) → (2,4) | Left | 16 |
| 23 | brown | (6,2) → (6,4) | Down | 15 |
| 24 | red | (2,4) → (5,4) | Right | 14 |
| 25 | brown | (1,4) → completion | Right | 13 |

The final intended stop was (4,4); its consequence showed completion particles
and then the native tally rather than a persistent settled five-marble board.

The successful process had **54 reviewed actions**, including two hovers.
All **52 presses** had an independent UP child prearmed before DOWN, immutable
DOWN expiry, actual child wait at exit 0 and both EOFs. All **53 nonterminal
actions** had actual post-release native batch progress. No UNKNOWN action
was replayed. Handler consumption alone was never treated as visual success.
The terminal controller records its release child's actual outcome and skips
post-exit progress/snapshot requests; it does not retry on server closure.

Ordinary Escape from Puzzle 6 displayed the native quit confirmation. Y
returned to the New Game submenu; Back returned to the full main menu.
After reviewing actual Quit highlighted white, an ordinary click produced
guest `[Exit] code=0` at **523.862 seconds**, before the unchanged 650-second
CLI cap. The final independent release child exited 0 and reported released.
Native mouse DOWN and UP precede Exit0. No terminal post-release progress
is claimed. Exit also logged one held critical section and Worker 1's
`Callback owner retired` slice failure after Exit0; no clean guest-lock or
diagnostic-free teardown claim is made. Native actual wait0, both EOFs and
process absence were verified.

An earlier fresh process reached the same selector/confirmation/Score0Moves38
board but ended before any marble input. The tool-observed supervisor wait
was 143; native and watchdog wait receipts were not produced. The cause is
unestablished. Its first selection failed at binding with connection refused
and an empty action log, and was never replayed. It has no gameplay, Exit0 or
ordinary-Quit claim. Compact evidence remains in `attempt1/` and
`interruption.json`; redundant captures were removed. All known earlier PIDs
were absent before the successful fresh process was queued. This second
process imported no earlier state and used a detached wait-recording supervisor.

TIM session 4's completed supervisor was checked before the first acquisition.
After the interruption, TIM session 6 ran before the second acquisition; no Q3
waiter was present at that acquisition. Q3 subsequently queued behind this
finite turn. Both attempts passed the full build under heavy-runtime and
build locks, plus `test-cli-guarded-input.js` and
`test-control-server-step-progress.js`. These controls validate input machinery,
not gameplay. Run-local helpers passed syntax parsing; selected PNGs passed
CRC/inflate/hash checks and scoped evidence validation passed.

Successful-run watchdog PID 3342499 acknowledged its finite 720-second deadline
before native PID 3343685 existed. No deadline was extended. Native wait0,
watchdog wait0, board watcher TERM/wait with both EOFs and supervisor wait0
were observed. The heavy lock was released promptly. All 57 known final-turn
PIDs were absent at postflight. Box ID none; state **NOT_CREATED**; expiry null;
stop receipt N/A. No boxes, other workers, browser or public deployment were
created. Only this report is committed; foreign WIP was preserved.

The assigned Puzzle 5 clear/tally/Puzzle 6 and ordinary Quit goal is fulfilled.
Puzzle 6 was observed but not played; any further gameplay is a separate task.
