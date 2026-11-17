# LMarbles Original Puzzle 6: bounded native selection blocker

The single fresh registered `lmarbles_108` process reached **Normal / Original /
Michael, Tier 1 Puzzle 6, Moves 32, Score 0**, with actual guest Workers. The
full board was personally reviewed and manually transcribed. **No marble was
successfully selected and no arrow slide was attempted. Puzzle 6 clear, tally,
counter transition and ordinary next Puzzle 7 remain unproved.**

Two intended selections of the brown marble at canvas **(354,330)** instead
opened the native confirmation to reenter the current level 6. The second
followed a separate, reviewed mouse move to that same point. Both confirmations
were declined with native N; the board remained Moves 32, Score 0. Gameplay
input stopped at this bounded selection blocker. No UNKNOWN was replayed, and
there was no second game launch.

Ordinary Escape displayed the native quit confirmation. Y returned to the
New Game submenu. Back was hovered and inspected white, then clicked. Actual
Quit in the full main menu was hovered and inspected white, then clicked.
Guest `[Exit] code=0` occurred at **297.574 seconds**, within the unchanged
900-second cap. Actual runtime, independent watchdog and outer-child wait for
the supervisor each returned 0, with both EOFs recorded. The heavy lock was
released and all 20 recorded runtime/release PIDs were absent. The outer
process's own parent wait is unavailable; process absence is not substituted
for that wait. Exit logged one held critical section and final T1 state
`active`; diagnostic-free guest teardown is not claimed.

Evidence: `scratch/runs/20261114-lmarbles-worker-puzzle6/result.json`.
Ten selected, personally reviewed PNGs remain:

- `new-game.png`: Normal / Original / Michael defaults.
- `selector-hover.png`: actual sixth gold hover caption, Tier 1 Puzzle 6;
  the fresh Tutorial still has Score 0.
- `selector-confirm.png`: current level 1/chapter 1, enter level 6/chapter 1.
- `board.png`: full fresh Puzzle 6, Moves 32, Score 0.
- `first-selection-prompt.png`: first intended marble selection opened reentry.
- `move-before-selection.png`: reviewed unchanged board after separate motion.
- `selection-after-motion-prompt.png`: second intended selection again opened
  reentry.
- `board-after-decline.png`: unchanged Puzzle 6 after declining the second prompt.
- `quit-confirm.png`: native quit confirmation.
- `quit-menu.png`: actual Quit highlighted white before the terminal click.

## Selection evidence and limits

`actions.json`, `observations.jsonl` and `native.stdout.log` distinguish handler
consumption, native message delivery and visible consequences. For the second
selection, the native mouse move and button messages carry client coordinates
**(331,287)**, matching canvas (354,330) after the visible window's (23,43)
client offset. Their presence did not establish successful marble selection.
The subsequent scene was the native level-6 reentry prompt, not a selected
marble. Menu hovers later visibly changed Back and Quit to white and allowed
ordinary shutdown.

The first explanation that SDL merely retained the selector position was an
inference, not an established cause. Separate native motion did not resolve the
selection discrepancy. No generic emulator defect was isolated or fixed, and
no production source was changed. Further work needs to isolate the native
selection path before another separately authorized gameplay attempt.

## Manual transcription and offline suggestion

This run's `manual-board.json` was entered from `board.png`, not read from the
guest or imported from a prior profile. Tile centers are **(98+32x,106+32y)**.
The complete board below uses `#` for wall, `.` for floor and spaces outside
the board. Coordinates start at the upper-left stone tile, (0,0).

```text
#####
#...#
#.#.#
#.#.#
#.#.#
#...######
###......#
#...####.#
###......#
#........#
#.#......#
##########
```

Red is at (2,1); orange at (1,7)/(8,10); brown at (1,10)/(8,7). The target
diagram has red at its center, orange at upper-right/lower-left, and brown at
upper-left/lower-right. The offline helper, which reads only this transcription
and has no runtime connection or input delivery, suggested 15 slides after
searching 72,011 states. **None of those slides was executed.** Its suggestion
is not native completion evidence. This fresh Score 0 is separate from the
earlier Puzzle 5 run's 1650 tally; scores were not summed or imported.

## Build, media and controls

Launch HEAD: `2d64da3bd7edde27f592cc903e108da99b156249`, plus
`runtime-dirty.patch`, `runtime-new.patch` and the loaded-source patches.
The accepted locked full build was reused only after all **317 accepted source
pins** and the module matched. No new full build was run. Actual loaded module:

`dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`.

All **321 launch/source/package/manifest pins**, **101 loaded-source records**
and **87 original media/CRT pins** matched at postflight. The in-place EXE was
`test/binaries/candidates/lmarbles-108/game/LMARBLES/lmarbles.exe`, SHA-256
`574df6673f136d399ab16afc145ca1ebf2589772884f2f47ce18c016f0fa40c5`.
The registered route used `C:\LMARBLES`, real ticks and a 1024×712 canvas.
No media, profile, save, board, score, configuration, clock or physics was
written by the controller. No media was copied or restored.

The original-media verifier passed the exact 86-file inventory and authentic
CRT. Its legacy manifest mode failed because the current manifest includes
SHA-256 properties and an EXE mapping. The first locked run-local preflight
also incorrectly expected 85 companion mappings and exited **before any game
launch**; its receipts remain in `preflight1/`. Only the owned verifier was
corrected. Explicit verification then passed all **86 actual mappings**, every
path/size/hash, and the manifest hash
`59139355d7323c216d032f0b619203fe6cc53a3a21450b6eb36393b6fcbbdb32`.
The installed manifest was never altered.

`native.stdout.log` proves actual guest Workers 1 and 2: each instantiated
**2317 exports / 294 brokered imports**, received initialization and was
reported `spawned WORKER thread`, slots 1/2, handles `0xe1000`/`0xe1001`.
The `--threads` flag alone is not the evidence. The CLI main guest stayed local.

All **16 reviewed actions** were consumed: 12 presses and four motions. Each
had an independent release child armed before its edge; all 16 children had
actual wait0 and both EOFs. All 12 native press releases were observed. All
15 nonterminal actions had actual post-release batch progress. The final
terminal action retained its release wait and requested no post-exit snapshot
or progress. No replay or rebind followed an UNKNOWN; none occurred.

The owned controller uses a finite **six-second operation deadline**, separate
from the **120 ms consumed-press duration**, with an independent immutable
fallback release. Capture and personal-review ages must each remain below
30 seconds. Actual maxima were **9.372 seconds capture age / 0.341 seconds
review age**. Each dependent action followed personal review of its latest
consequence. No future marble moves were queued.

Six controller checks passed against the production HTTP transport/guard:
delayed 60 ms press, dropped-ACK sticky UNKNOWN, mouse input, deadline/fallback,
stale capture and stale review. One additional focused native-N whitelist
fixture passed without changing guard/deadline/release logic. Four supervision
fixtures and the actual outer-child-wait fixture passed. Locked focused input,
Worker and lifecycle checks all passed:

- `test-cli-input-owner.js`
- `test-cli-guarded-input.js`
- `test-control-server-step-progress.js`
- `test-guest-main-start-cleanup.js`
- `test-guest-thread-bootstrap-cleanup.js`
- `test-thread-exit-callback-cleanup.js`

The attempt acquired the heavy lock after the current Q2 and SuperTux turns.
The independent 920-second watchdog acknowledged arming before native launch;
it exited after the actual native wait without firing. Selected PNG CRC,
inflate and SHA checks passed; scoped evidence validation reported no errors,
missing files or invalid metadata. Foreign global evidence errors were left
untouched. Intermediate frames were removed, leaving selected PNGs, compact
logs/JSON and Git/new-file patches. Git remains the source archive; no source
tree, wasm dump or media copy was retained.

Box ID none; state **NOT_CREATED**; expiry null; stop receipt N/A. Free disk
remained above 1.5 GB (about 13.5 GB at final runtime review). No other workers,
boxes, downloads or public deployments were created. Foreign NE/render/host
WIP was preserved. This is the bounded blocker report, not a Puzzle 6 clear or
full-27 acceptance claim. No further runtime is authorized by this task.
