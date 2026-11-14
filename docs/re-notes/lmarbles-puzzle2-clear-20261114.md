# LMarbles Original Puzzle 2: native clear, 1650 tally, Puzzle 3

Fresh registered **`lmarbles_108`, Original, Tier 1 Puzzle 2** cleared through
fifteen ordinary, individually reviewed slides. The native completion particle
animation displayed **Moves 13**. The subsequent tally displayed **Total Score
1650**, with both bonus counters depleted to zero. Ordinary Enter advanced to
**Tier 1 Puzzle 3, Moves 34, Score 1650**. These are current runtime observations,
not a promotion of the historical Moves 16 checkpoint or static route.

Evidence: `scratch/runs/20261114-lmarbles-puzzle2-clear/result.json`. Personally
reviewed retained full native frames:

- `board.png`: Original Tier 1 Puzzle 2, Moves 28, Score 0.
- `before-final.png`: Moves 14, Score 0, selected red at (3,3), red at (5,3),
  maroons at (4,4)/(6,4), yellow at (5,4).
- `clear-animation.png`: native marble particle explosion, Moves 13.
- `tally.png`: Total Score 1650 over the completed Puzzle 2 board.
- `next.png`: Original Tier 1 Puzzle 3, Moves 34, Score 1650.

No literal “CLEAR” caption was observed. The native completion animation,
authentic tally, score award and next-puzzle transition establish the clear.

The fresh menu retained Normal/Original/Michael defaults. Hovering the second
gold selector visibly labelled Tier 1 Puzzle 2; clicking produced the native
“enter level 2 of chapter 1?” confirmation. Balanced Y entered the fresh board.
No Tutorial completion was used. The board and target were inspected before
gameplay: the target was red above yellow, over red–maroon–yellow–maroon.

Public-frame tile centers were `(98+32*x,154+32*y)`. Each selection ring and
every settled consequence was personally inspected before the next input.
Where the same marble remained selected, its retained ring was reviewed
without an unnecessary second click.

| Slide | Color | From → To | Arrow | Moves left |
| --- | --- | --- | --- | --- |
| 1 | red | (8,7) → (8,1) | Up | 27 |
| 2 | maroon | (6,1) → (4,1) | Left | 26 |
| 3 | red | (8,1) → (5,1) | Left | 25 |
| 4 | yellow | (1,7) → (2,7) | Right | 24 |
| 5 | yellow | (2,7) → (2,4) | Up | 23 |
| 6 | maroon | (4,4) → (8,4) | Right | 22 |
| 7 | yellow | (2,4) → (7,4) | Right | 21 |
| 8 | maroon | (4,1) → (4,4) | Down | 20 |
| 9 | red | (3,1) → (4,1) | Right | 19 |
| 10 | red | (4,1) → (4,3) | Down | 18 |
| 11 | red | (4,3) → (3,3) | Left | 17 |
| 12 | yellow | (7,4) → (5,4) | Left | 16 |
| 13 | maroon | (8,4) → (6,4) | Left | 15 |
| 14 | red | (5,1) → (5,3) | Down | 14 |
| 15 | red | (3,3) → completion | Down | 13 |

The final expected stop was (3,4); the captured consequence was the native
completion animation rather than a persistent five-marble settled frame.
The historic three-slide hints were used only after this run's preceding
states and rings were freshly reviewed.

Current source was built successfully under both `/tmp/wine-heavy-runtime.lock`
and `/tmp/wine-build.lock`. Launch source commit was
`3f6b5694ab1e7cf048aa29881221a2250aa5019d`, plus the recorded relevant binary
dirty diff and untracked-runtime patch. Loaded module SHA-256 was
`c7f5bada4da4b4ed95b235add0aa1c9843176805d29d5b1ee79359752a19d348`.
`source-pins.json`, `runtime-dirty.patch`, `runtime-new.patch` and
`owned-helpers.patch` preserve source identity using Git, without source
archives or module dumps. The module remained unchanged through shutdown.
Only `lib/d3d9-render-worker.js` changed among the launch-pinned runtime files
during gameplay, by its separate owner; this cooperative DirectDraw game did
not launch that D3D9 worker. No foreign WIP was adopted or committed.

Original EXE remained at
`test/binaries/candidates/lmarbles-108/game/LMARBLES/lmarbles.exe`, SHA-256
`574df6673f136d399ab16afc145ca1ebf2589772884f2f47ce18c016f0fa40c5`.
All existing 86 original media files plus CRT matched their supplied pins both
before and after execution. The registered manifest/CWD were used directly;
media was neither copied nor restored. Runtime used real ticks, cooperative
threads, a 1024×712 canvas and the ordinary control channel.

The new scratch controller required a fresh hashed native PNG and explicit
observation/expected consequence for each action. Each DOWN had an immutable
expiry before an independently prearmed release. All **32 presses** had release
children actually joined at exit 0 with both EOFs and subsequent native batch
progress. All 34 actions and fifteen slides passed the postflight checks.
An initial motion-only hover was released too early to reach the guest; a
controller-only delivery delay produced the reviewed hover. Handler consumption
was never treated as proof of guest input delivery or visual success.

Focused tests `test-cli-guarded-input.js` and
`test-control-server-step-progress.js` passed; both scratch Python helpers
passed syntax parsing. No production source repair was needed. Only this
document is committed. Intermediate reviewed PNGs were overwritten during
operation and removed at the end; only the five result-named key PNGs remain.
Compact action records preserve their hashes, observations and receipts.

Independent watchdog PID3196469 acknowledged its finite 1500-second deadline
before native PID3197737 existed. Runtime also had a 1300-second limit; neither
deadline was extended. After the next-puzzle capture, normal control quit
returned native exit 0; stdout/stderr were drained to EOF and the process was
absent. Watchdog exit 0, board watcher TERM/wait, and outer session59473 exit 0
were all observed. The heavy lock was released before evidence finalization.
Box ID none; state NOT_CREATED; expiry null; stop receipt N/A.

The assigned clear/tally/continuation goal is fulfilled. No guest/configuration/
clock/score writes, state import, forced readiness, fake acknowledgments,
browser, public deployment, other workers or boxes were used. Further Puzzle 3
gameplay would be a separate task.
