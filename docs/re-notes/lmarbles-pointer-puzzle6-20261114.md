# LMarbles selection discrepancy and native Puzzle 6

Puzzle 6 cleared in the fresh registered Normal / Original / Michael run.
Fourteen personally reviewed slides left 18 moves; the native tally reported
1900 points. Enter dismissed the tally and the next native board visibly read
Tier 1, Puzzle 7, Moves 48, Score 1900. Escape/Y, Back and the actual Quit menu
item then produced `[Exit] code=0`. Full 27 remains unproved.

The selection repair is **not complete**. Candidate commit `72590a235` sent
motion before coordinate presses in guarded and ordinary CLI delivery. Its
public queue regression passed, but the fresh native first press at canvas
(354,330) still reopened the level-6 confirmation. That candidate and its
queue-only regression were removed after this disconfirming validation. The
fixture never established SDL-observed motion or the game's selected widget,
so its green result was insufficient evidence of a causal repair. No effective
selection source change is claimed.

The precise remaining discrepancy is downstream of correct queued WM coordinates
and the current pointer: verified original SDL_GetMouseState returned client
(331,287), renderer physical position was canvas (354,330), but LMarbles'
last SDL motion remained (556,359), the sixth selector. Its mode was 0 and
selected flag 0. The pre-fix diagnostic reproduced both the direct-press
failure and the ineffective subsequent same-point motion. A distinct motion
to canvas (322,330), then onto (354,330), changed the game's last motion to
(331,287), mode 1; the following guarded press visibly selected brown tile
(8,7), with selected flag 1 and a blue ring. The first distinct point is a wall,
despite an early intent label calling it empty. The fresh validation repeated
the failed press, declined the prompt with N, and used that distinct-motion
sequence successfully. The prompt was never accepted as marble selection.

Evidence: `scratch/runs/20261114-lmarbles-pointer-puzzle6/`. Read-only inspection
checked the original SDL getter bytes and relocated operands before reading
SDL pointer and game classification fields. No guest calls, state writes,
profile/config/score/board/clock/physics edits, guard bypass, UNKNOWN clearing,
Pause, replay or active-run extension occurred. Every gameplay choice, visible
selection ring and settled slide was personally reviewed. The controller
required capture/review age <=30s, armed an independent release before each
edge, separated its six-second operation deadline from the pulse, and recorded
postrelease progress. Final Quit instead waited for actual native exit.

The initial offline transcription missed walls at (7,9) and (8,9). The first
brown slide visibly settled at (8,8), disproving the old suggested destination
(8,9). The corrected manual transcription generated a 13-move suggestion for
the remaining board. The search had no runtime connection and delivered no
input. Reviewed actual slides (color, start, direction, settled destination):

| # | Color | Start | Direction | End |
|---|---|---|---|---|
| 1 | brown | 8,7 | down | 8,8 |
| 2 | brown | 1,10 | up | 1,9 |
| 3 | brown | 1,9 | right | 6,9 |
| 4 | orange | 1,7 | right | 3,7 |
| 5 | orange | 8,10 | left | 3,10 |
| 6 | orange | 3,7 | down | 3,9 |
| 7 | orange | 3,9 | right | 5,9 |
| 8 | red | 2,1 | right | 3,1 |
| 9 | red | 3,1 | down | 3,9 |
| 10 | red | 3,9 | right | 4,9 |
| 11 | brown | 8,8 | left | 3,8 |
| 12 | orange | 5,9 | up | 5,8 |
| 13 | brown | 6,9 | left | 5,9 |
| 14 | brown | 5,9 | down | 5,10 |

The final arrangement matches the displayed target around red (4,9).
`slide14.png` shows native clear particles; `tally6.png` shows the tally;
`puzzle7.png` independently shows the next board. `settled01.png` and
`settled09.png` resolve intermediate animation captures before further input.

The one permitted pre-fix diagnostic used a fixed 600-second original cap and
prearmed independent 620-second watchdog. Actual native Quit occurred at
198.809s. The single validation used fixed 900/920 limits and exited through
native Quit at 616.516s. Actual native, watchdog, supervisor outer-child and
outer tool waits were all 0, with separate stdout/stderr EOF records; neither
watchdog fired. Both heavy turns followed the completed SuperTux-direct and
nativeGL-resize turns. The heavy lock was released. Actual guest Workers 1
and 2 were instantiated in each native log (2317 exports, 294 brokered imports),
not inferred from `--threads`. The validation log also retains a callback-owner
retirement/sliceDone diagnostic after native Exit0; this is not hidden as a
clean Worker teardown claim.

Current original 87-file media inventory, 86 manifest mappings and CRT were
verified by path, size and SHA-256. Both runs used module
`dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`.
Exact Git identities, relevant dirty/new-file patches and source/module/media
pins are retained; no source tree/module/media archive was made. Validation
postflight media had zero drift and the module matched. Two on-disk source
files changed during the run under the other worker's claims:
`lib/cli-input-owner.js` and `lib/d3dim-gpu.js`; the already running process
used its prelaunch loaded code. These foreign changes were preserved. All
other pinned files matched before removing the candidate.

The public Sol fixture passed target HWND, real client-origin offset and
current-pointer checks. A separate actual CLI/guard/renderer-to-RPC-slot
fixture exposed missing CLI `inputEventScope`: a second slot overwrites the
first slot's lParam and current-pointer snapshot. Browser host.js supplies this
scope; CLI host tables do not. This is a reproducible generic omission, but
its causal connection to this native SDL failure remains unproved. It was not
speculatively repaired. A next repair needs an actual SDL public-path fixture
that distinguishes event-pump pointer sampling from interleaved slot metadata
and asserts the resulting SDL motion/selected widget, rather than queue order
alone. No further original run was launched after exhausting the allowance.

Focused guard, owner, relative mouse, renderer cursor/drag, cursor-warp, input
receipt/slice, guest bootstrap and thread-exit controls passed, as did the
locked full build for the candidate. The removal also received focused tests
and a locked full build. Existing unrelated failures are retained: WinMine
startup missing NE COMMCTRL (three fixtures), input-consumption extraction
missing cliObservation, API batching's extra dx_trace null argument, and the
mouse_event X-button assertion. Controller, freshness/UNKNOWN and independent
supervision controls passed. See compact test JSON/logs for exact waits.

No box was created: ID none, state NOT_CREATED, expiry null, stop receipt N/A.
No network deployment or other workers were launched. The remaining missing
outcome is a tested causal selection repair; native Puzzle6 clear, tally,
nextPuzzle7 and actual Quit are established separately.
