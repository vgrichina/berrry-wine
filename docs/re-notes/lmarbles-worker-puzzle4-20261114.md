# LMarbles Original Puzzle 4: actual guest Workers, clear, Puzzle 5 and Quit

Fresh registered `lmarbles_108`, **Normal / Original / Michael**, cleared
**Tier 1 Puzzle 4 after 22 individually reviewed slides**. Native completion
particles appeared with **Moves 12**. The tally then showed **Total Score
1600**, **Level Bonus 0**, **Move Bonus 0**. Ordinary Enter advanced to
**Tier 1 Puzzle 5, Moves 38, Score 1600**. These native transitions establish
completion; no literal CLEAR caption was observed or inferred.

Evidence: `scratch/runs/20261114-lmarbles-worker-puzzle4/result.json`.
Only nine selected, personally inspected result captures remain:

- `selector-hover.png`: fourth gold selector, actual Tier 1 Puzzle 4 caption;
  the fresh Tutorial still has Score 0.
- `selector-confirm.png`: native confirmation explicitly names level 4 of
  chapter 1, from current level 1 of chapter 1.
- `board.png`: fresh Puzzle 4, Moves 34, Score 0.
- `before-final.png`: Moves 13; yellow (4,1), red (5,1), selected yellow (6,2).
- `clear-animation.png`: native yellow/red completion particles, Moves 12.
- `tally.png`: Total Score 1600, both bonus counters zero.
- `next.png`: Puzzle 5, Moves 38, Score 1600.
- `quit-confirm.png`: native “Do you really want to quit? (y/n)” prompt.
- `quit-menu.png`: full main menu, actual Quit highlighted white.

New Game visibly retained the Normal/Original/Michael defaults. Start entered
the fresh Tutorial with Score 0; the fourth gold selector was hovered, reviewed,
clicked and confirmed with Y. No prior score, save, profile or board was imported.
This fresh score of 1600 is distinct from the predecessor Puzzle 3 run's 1550.

`native.stdout.log` establishes actual guest Worker execution: Workers 1 and 2
each instantiated with 2313 exports and 294 brokered imports, received guest
register/stack initialization, and were reported as **spawned WORKER thread**
at slots 1/2, handles `0xe1000`/`0xe1001`. The main guest remains local in this
CLI architecture. The `--threads` flag alone is not the evidence. Both Workers
logged `unexpected message writerRegistered` before successful instantiation;
neither caused a gameplay failure or cooperative fallback.

Launch source commit: `bffbc3805596a9cc3dd4788b5188a42b33475440`, plus
`runtime-dirty.patch` and `runtime-new.patch`. All **315 runtime/source/module
pins** matched through postflight. The loaded module SHA-256 was
`c7f5bada4da4b4ed95b235add0aa1c9843176805d29d5b1ee79359752a19d348`.
All **87 original media/CRT pins** matched before and after gameplay. The EXE
remained at `test/binaries/candidates/lmarbles-108/game/LMARBLES/lmarbles.exe`,
SHA-256 `574df6673f136d399ab16afc145ca1ebf2589772884f2f47ce18c016f0fa40c5`.
The registered manifest and `C:\LMARBLES` working directory were used in place.
No media was copied or restored. Runtime used real ticks and a 1024×712 canvas.
Git plus binary patches preserve source identity; no source archives or module
dumps were made. No production change was needed.

Tile centers are `(98+32*x,138+32*y)`, derived from this run's reviewed board.
An offline search over a manual transcription proposed the route below. It had
no guest/process access or input delivery. Every selected marble and every
settled slide consequence was personally reviewed before dependent input.
No guest board, score, configuration, clock or physics was written.

| Slide | Color | From → To | Arrow | Moves left |
| --- | --- | --- | --- | --- |
| 1 | red | (8,1) → (1,1) | Left | 33 |
| 2 | yellow | (2,5) → (2,6) | Down | 32 |
| 3 | yellow | (2,6) → (5,6) | Right | 31 |
| 4 | yellow | (5,6) → (5,1) | Up | 30 |
| 5 | red | (1,1) → (4,1) | Right | 29 |
| 6 | red | (4,1) → (4,8) | Down | 28 |
| 7 | red | (4,8) → (3,8) | Left | 27 |
| 8 | red | (3,8) → (3,6) | Up | 26 |
| 9 | red | (3,6) → (5,6) | Right | 25 |
| 10 | yellow | (5,1) → (5,5) | Down | 24 |
| 11 | yellow | (8,3) → (8,8) | Down | 23 |
| 12 | yellow | (5,5) → (8,5) | Right | 22 |
| 13 | red | (5,6) → (5,1) | Up | 21 |
| 14 | yellow | (8,8) → (8,6) | Up | 20 |
| 15 | yellow | (8,5) → (4,5) | Left | 19 |
| 16 | yellow | (4,5) → (4,1) | Up | 18 |
| 17 | yellow | (8,6) → (7,6) | Left | 17 |
| 18 | yellow | (7,6) → (7,5) | Up | 16 |
| 19 | yellow | (7,5) → (4,5) | Left | 15 |
| 20 | yellow | (4,5) → (4,2) | Up | 14 |
| 21 | yellow | (4,2) → (6,2) | Right | 13 |
| 22 | yellow | (6,2) → completion | Up | 12 |

The last intended stop was (6,1); the consequence showed completion particles,
followed by the native tally and next puzzle, rather than a persistent settled
three-marble board. Intermediate screenshots were overwritten and removed.

There were **43 reviewed actions**, including two hovers. All **41 presses**
had an independent UP child prearmed before DOWN and an immutable DOWN expiry.
The first **40 release children exited 0**, actually waited with both EOFs.
All **42 nonterminal actions** had actual post-release native batch progress.
No UNKNOWN action was replayed, and handler consumption alone was not treated
as visual success.

Ordinary Escape from Puzzle 5 displayed the native quit confirmation. Y
returned to the New Game submenu; Back returned to the full main menu. After
reviewing the highlighted Quit entry, an ordinary mouse click produced guest
`[Exit] code=0`, at **434.886 seconds**, before the unchanged 650-second CLI cap.
The final prearmed release child exited **1** because the native control server
had already closed. Its actual wait and both EOFs are retained in
`application-quit-action.json`; it was not replayed. The native log records
mouse DOWN then UP before guest Exit0; the CLI's guarded-input shutdown releases
its binding. No terminal post-release snapshot/progress is claimed. A held
guest critical-section diagnostic also appeared at exit; no lock-free guest
state claim is made. Native process exit and absence were verified.

The full build passed under both `/tmp/wine-heavy-runtime.lock` and
`/tmp/wine-build.lock`. Focused `test-cli-guarded-input.js` and
`test-control-server-step-progress.js` passed. The former's CLI fixture is
control-mechanism validation, not gameplay evidence. All run-local Python
helpers parsed successfully. Artifact hashes and scoped evidence checks are
recorded in the run directory.

Fair-turn correction: Q3's queued final turn ran first. An earlier preparation
acquired the heavy lock ahead of TIM's replacement waiter; this was caught
during the build and cancelled **before any LMarbles launch**. Supervisor wait
130, watchdog wait0 and board-watcher join were observed, with no remaining
build. The task then requeued behind the actual TIM holder. That cancellation
and a prior queue-only restart are retained separately; neither is gameplay.

The final independent watchdog PID 3321360 acknowledged its original finite
720-second deadline before native PID 3322221 existed. Neither deadline was
extended. Native actual wait0, stdout/stderr EOF, watchdog wait0, board watcher
TERM/wait with both EOFs and supervisor wait0 were observed. The heavy lock
was released promptly. Postflight found all 45 known final-turn PIDs absent.
Box ID none; state **NOT_CREATED**; expiry null; stop receipt N/A. No boxes,
other workers, browser or public deployment were created.

The assigned Puzzle 4 clear/next and ordinary Quit goal is fulfilled. Puzzle 5
was observed but not played. Only this report is committed; foreign WIP was
preserved. Any Puzzle 5 gameplay is a separate next task.
