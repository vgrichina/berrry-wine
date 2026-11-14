# LMarbles Original Puzzle 3: real guest Workers, clear and Puzzle 4

Fresh registered `lmarbles_108`, Normal/Original/Michael, **Tier 1 Puzzle 3**
cleared after **23 individually reviewed slides** under **`--threads`**.
Native completion particles showed **Moves 11**; the subsequent tally showed
**Total Score 1550**, with both bonus counters at zero. Ordinary Enter advanced
to **Tier 1 Puzzle 4, Moves 34, Score 1550**. No literal CLEAR caption was seen;
the completion animation, tally and next-puzzle transition establish the clear.

Evidence: `scratch/runs/20261114-lmarbles-worker-puzzle3/result.json`.
Personally reviewed retained native frames:

- `board.png`: fresh Puzzle 3, Moves 34, Score 0.
- `before-final.png`: Moves 12, selected cyan at (2,1), purple at (3,2)/(3,4),
  cyan at (4,3).
- `clear-animation.png`: native purple/cyan completion particles, Moves 11.
- `tally.png`: Total Score 1550, Level Bonus 0, Move Bonus 0.
- `next.png`: Tier 1 Puzzle 4, Moves 34, Score 1550.

The normal New Game menu retained Normal/Original/Michael defaults. After
Start, the fresh Tutorial board had Score 0. Hovering the third gold selector
visibly labelled Tier 1 Puzzle 3. Clicking displayed the native “enter level 3
of chapter 1?” confirmation; balanced Y entered the fresh board. The previous
cooperative run's score, board and profile were never imported. The existing
media manifest and `c:\lmarbles` working directory were used directly.

Actual Worker evidence is in `native.stdout.log`: the explicit `--threads`
startup line, then guest-worker 1 and 2 instantiation messages (2313 exports,
294 brokered imports), guest register/stack initialization and **spawned WORKER
thread** messages for slots 1/2, handles `0xe1000`/`0xe1001`. The Node main
guest instance remains local in this CLI architecture; the additional guest
threads run in real Node Workers. This is not a claim that slot 0 runs remotely.
The log also contains `unexpected message writerRegistered` for each Worker;
both continued through instantiation and gameplay. No cooperative fallback,
Worker startup failure or gameplay defect occurred. No production fix was needed.

Launch source commit was `27bddf2cb10da0529325a1bb61a6d3823ee46185`, plus
`runtime-dirty.patch` and `runtime-new.patch`. `source-pins.json` records runtime
file hashes; none changed through postflight. The locked full build passed and
the loaded module SHA-256 was
`c7f5bada4da4b4ed95b235add0aa1c9843176805d29d5b1ee79359752a19d348`.
The same module is supplied to the guest Worker machinery; it was unchanged
after shutdown. Git and binary patches preserve source identity without source
archives or module dumps. Foreign WIP was neither edited nor committed.

Original EXE:
`test/binaries/candidates/lmarbles-108/game/LMARBLES/lmarbles.exe`, SHA-256
`574df6673f136d399ab16afc145ca1ebf2589772884f2f47ce18c016f0fa40c5`.
All **87 original media/CRT pins** matched before and after execution. Media
was referenced in place, without copying or restoring it. Runtime used real
ticks and a 1024×712 canvas.

Tile centers below are `(82+32*x,154+32*y)`, derived from the reviewed image.
Purple and cyan form a diamond around an empty center. An offline search over
the manually transcribed visible board suggested the last twenty slides after
the first three. It had no guest/process access and could not send inputs.
Every selection ring and settled consequence was then personally inspected
before the next action; no route was blindly replayed. No guest board, solver
state, score, configuration or clock was written.

| Slide | Color | From → To | Arrow | Moves left |
| --- | --- | --- | --- | --- |
| 1 | purple | (8,1) → (2,1) | Left | 33 |
| 2 | purple | (2,1) → (2,3) | Down | 32 |
| 3 | purple | (2,3) → (3,3) | Right | 31 |
| 4 | purple | (3,3) → (3,6) | Down | 30 |
| 5 | purple | (4,3) → (2,3) | Left | 29 |
| 6 | cyan | (1,6) → (1,5) | Up | 28 |
| 7 | cyan | (8,7) → (9,7) | Right | 27 |
| 8 | cyan | (9,7) → (9,3) | Up | 26 |
| 9 | cyan | (9,3) → (6,3) | Left | 25 |
| 10 | cyan | (6,3) → (6,6) | Down | 24 |
| 11 | cyan | (6,6) → (4,6) | Left | 23 |
| 12 | cyan | (4,6) → (4,5) | Up | 22 |
| 13 | cyan | (1,5) → (3,5) | Right | 21 |
| 14 | cyan | (3,5) → (3,1) | Up | 20 |
| 15 | cyan | (4,5) → (7,5) | Right | 19 |
| 16 | cyan | (7,5) → (7,1) | Up | 18 |
| 17 | cyan | (7,1) → (4,1) | Left | 17 |
| 18 | cyan | (4,1) → (4,3) | Down | 16 |
| 19 | purple | (2,3) → (3,3) | Right | 15 |
| 20 | purple | (3,6) → (3,4) | Up | 14 |
| 21 | purple | (3,3) → (3,2) | Up | 13 |
| 22 | cyan | (3,1) → (2,1) | Left | 12 |
| 23 | cyan | (2,1) → completion | Down | 11 |

The final expected stop was (2,3); its consequence capture shows completion
particles rather than a persistent four-marble settled board.

The reused run-local controller binds every action to a fresh hashed native
PNG with an explicit observation and expected consequence. One attempted
selection was refused before dispatch because its reviewed frame was older
than 90 seconds; a new capture was reviewed before the actual selection.
All **39 actions**, including one hover, had post-release native batch
progress. All **38 presses** had independently prearmed release children,
immutable DOWN expiry, actual child wait at exit 0 and both EOFs. A handler
consumption receipt alone was never treated as visual success. Intermediate
images were overwritten and removed; only the five result-named PNGs remain.

Focused tests `test-cli-guarded-input.js` and
`test-control-server-step-progress.js` passed. The former runs an actual CLI
fixture with its own independent watchdog; it validates the control mechanism
and is not gameplay evidence. Scratch helpers passed Python syntax parsing.
The full build passed under both `/tmp/wine-heavy-runtime.lock` and
`/tmp/wine-build.lock`. Only this report is committed.

Independent watchdog PID 3239476 acknowledged its original finite 720-second
deadline before native PID 3240538 existed; native also had a 650-second limit.
Neither deadline was extended. After Puzzle 4 review, ordinary control quit
returned native exit 0, stdout/stderr were drained to EOF, and the process was
absent. Watchdog exit 0, board watcher TERM/wait with both EOFs and outer
runtime supervisor exit 0 were observed. The heavy lock was released promptly
after next-puzzle verification. Focused CLI testing used a separate bounded
lock acquisition and released it at completion. No processes remain from this
task. Box ID none; state NOT_CREATED; expiry null; stop receipt N/A.

The assigned Worker Puzzle 3 clear/next goal is fulfilled. Puzzle 4 gameplay
was not attempted. No boxes, browsers, public deployment or other workers were
created; no game media or foreign WIP was changed.
