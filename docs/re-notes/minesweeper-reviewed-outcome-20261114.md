# Native Minesweeper reviewed board, 2026-11-14

**One default native beginner board was won naturally, then closed with
Game → Exit.** I personally reviewed the revealed numbers after all fifteen
square clicks, the native fastest-time prompt, the completed board with
sunglasses and ten automatic flags, the best-times entry of **311 seconds**,
the native Exit menu, and the empty desktop after closure. There was no second
board. Evidence: `scratch/runs/20261114-minesweeper-reviewed-outcome/result.json`.

The requested registered app is `winmine_wep`, using
`test/binaries/entertainment-pack/winmine.exe`: 40,720 bytes,
SHA-256 `2b554103fb9007c23b6c42eae4b410e294700fb82f84cf846a10e7a2a0d30a7d`.
The before/after executable hashes and size match exactly. There was no
replacement executable, download, alternate Win16/XP image, guest configuration
change, hidden-board inspection, seed change, or clock change. This is current
Win32 gameplay evidence, separate from historical menu/color-art tests.

`tools/minesweeper-controller.py` wraps the released, unchanged Barrage
transport. It distinguishes personally reviewed bootstrap and actual board
scenes, permits one phase-specific native Start before board admission, and
requires actual visible default-board review before square gestures. In this
run the actual untouched 8×8 board appeared directly at launch and was reviewed
before permanent binding: `baseline.png`, PID 3984050, start token 273812790,
main HWND `0x10001`, full 800×600 desktop. No bootstrap Start was needed.
The reviewed transport maps pointer commands to Win32 left-button down/up.
Right flags and chording were refused and unused. All ten flags in the final
image were placed by the native game on winning; there is no manual flag claim.

The first click, r1c1, was an honest opening guess and revealed a blue 1.
Exactly one of its three neighbors was a mine, with no uniquely safe choice.
The second guess, r8c8, opened a blank region across the upper/right board.
The remaining thirteen clicks were safe deductions from personally reviewed
displayed numbers, never a board reader or solver. Rows and columns below are
one-based. This is a retrospective record, not an automated action list.

| Click | Square | Displayed-number reason | Personally reviewed consequence |
|---|---|---|---|
| 1 | r1c1 | Opening guess; no numbers | Blue 1 |
| 2 | r8c8 | Unconstrained opposite-corner guess | Blank flood and numbered boundary |
| 3 | r2c2 | r3c4's 1 forces r4c3, satisfying r3c3's 1 | Blue 1 |
| 4 | r3c1 | r1c3 then forces r1c2, satisfying r2c2's 1 | Blank flood down left edge |
| 5 | r5c3 | r4c2's 1 already satisfied by r4c3 | Green 2 |
| 6 | r6c4 | r5c2 forces r6c3; r5c3's 2 satisfied by r4c3/r6c3 | Red 3 |
| 7 | r5c4 | Same satisfied r5c3 | Red 3 |
| 8 | r6c5 | r4c6 forces r5c5, satisfying r5c6 | Red 3 |
| 9 | r7c5 | r6c7 forces r7c6; r6c6 satisfied by r5c5/r7c6 | Red 3 |
| 10 | r8c4 | r7c7 forces r8c6; r6c4/r6c5 imply r7c4; r7c5 satisfied | Blue 1 |
| 11 | r8c3 | r8c4's 1 satisfied by r7c4 | Green 2 |
| 12 | r8c2 | r6c1 forces r7c1/r7c2; r8c3 satisfied by r7c2/r7c4 | Green 2 |
| 13 | r8c1 | r8c2's 2 satisfied by r7c1/r7c2 | Green 2 |
| 14 | r7c3 | r8c3's 2 already satisfied | Red 3 |
| 15 | r8c5 | r7c5's 3 satisfied by r7c4/r7c6/r8c6 | Red 3; native fastest-time prompt and sunglasses |

Gameplay stopped immediately on that natural win. I dismissed the visible
name prompt with its native OK, retaining `Anonymous`, then dismissed the
visible best-times table with its OK. Reset Scores was untouched. These were
separately observed, nonfinal result-dialog clicks using the unchanged released
Barrage transport inside the irreversible Quit phase; they were not Exit
claims. `scoresok.png` shows the whole won board and its automatic flags.
`openexit.png` shows the actual Game menu with Beginner checked and Exit visible.
Selecting Exit closed the game without a further confirmation. There was no
smiley click, reset, difficulty change, manual flag, chord, or post-win square
input. The win is established by the native result prompt and completed board,
not the mine counter alone.

The one recipe was fixed at 900 seconds with an independently prearmed
920-second watchdog, default 1000-block slices and real ticks. Its mechanical
180-second Quit reserve was unchanged; voluntary Quit phase began at 478.265
seconds, before the 720-second gameplay cutoff. Native wait completed at
494.672 seconds; the CLI reported 494.303 seconds. Every consumed square
gesture used a personally reviewed scene less than five seconds old at
consumption, a 400ms pulse and independently prearmed 1750ms fallback release.
Menu/result scenes used thirty seconds. Eight expired square intents were
`NOT_SENT` before DOWN; each used a new capture and new intent afterward.
Five preliminary board-admission reviews and one outcome attestation also
expired without input. No guard was widened. No mixed/UNKNOWN input occurred,
and there was one permanent binding with no replay or rebind.

The final Exit receipt is `CONSUMED`. Its release result is `OWNER_EXITED`,
with the matching actual native wait and both EOFs inside the finite bound;
**physical button-up was not acknowledged**, because the process had already
exited. This is preserved honestly in `nativeexit-up.json`. All other eighteen
consumed gestures have release ACKs. Native, watchdog, supervisor child and
outer waits each returned 0 with both EOFs; the watchdog exited on the actual
native wait without firing. All owned runtime PIDs were absent and port 8601
was closed. No host Quit or cancellation was used.

Before heavy work, I revalidated FreeCell's four successful actual waits and
GLTron's startup-refusal terminal (native 1, other waits 0), both with both EOFs,
heavy release and absent PIDs. Under `/tmp/wine-heavy-runtime.lock`, my own
19 policy tests, 12 HTTP refusal/terminal controls, 10 actual CLI Solitaire
fixture controls, and `flock /tmp/wine-build.lock bash tools/build.sh` all passed.
The actual fixture controls cover release after slow persistence, parent death,
pipe EOF, late/dropped ACK, physical hold bounds and bootstrap/board policy.
They do not count as Minesweeper gameplay. The original loaded no fixture code.

The run pins 311 exact then-current sources/module/media files; postflight
found zero drift. Git SHA plus binary tracked/untracked patches retain source
provenance without source/media/WASM copies. Eleven selected, personally
reviewed PNGs are explicitly named in `result.json`; forty unselected captures
were removed with hashes recorded. The native CLI warned that absent
`shell32.dll` imports fall back to existing WAT stubs. No DLL was downloaded or
replaced; this limits any broader API-compatibility claim.

Selected-image CRC/inflate/SHA validation passed for all eleven 800×600 PNGs.
The evidence checker reported no errors, missing references, or invalid metadata
for this run; foreign evidence issues were left untouched. The separate
messageboard-watcher tool session returned 143 without an actual watcher
wait/EOF receipt. Its recorded tail PID was absent; foreign watchers were left
alone. This ancillary missing proof does not replace or weaken the four recorded
actual game-runtime waits.

Box ID: null; state: `NOT_CREATED`; expiry: null; stop receipt: N/A. Execution
was local. No browser, full-27-game, FPS, audio, or public deployment claim is
made. No additional gameplay is next for this bounded task.
