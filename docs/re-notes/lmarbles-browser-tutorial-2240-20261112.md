# LMarbles 1.0.8: browser Tutorial cleared, 2026-11-12

The registered **`lmarbles_108` original Win32 game cleared the first Tutorial
puzzle in the browser through ordinary selection and eleven arrow moves**.
Moves decreased **18 → 7**. The native completion animation was followed by a
bonus tally showing **Total Score 1350**. An ordinary Enter continued to
**Tier 1, Puzzle 2**, with **Score 1350 / Moves 28**. This extends the accepted
October 18 CLI movement proof to browser movement and first-puzzle completion.

Run: `scratch/runs/20261112-lmarbles-browser-tutorial-2240/`.
The [earlier launch notes](lmarbles-first-launch.md) and `lib/apps.js` registry
were read before work. No emulator, registry, game, level or configuration code
was patched. No guest memory, level or profile was edited to obtain progress;
there were no skips, game console commands, AI or clock changes.

## Original recovery and launch

The old source directory and canonical media directory were absent. Recovery
used only the authorized official URL:

`https://downloads.sourceforge.net/project/lgames/lmarbles/lmarbles-1.0.8-win32.zip`

The downloaded ZIP was **1,753,947 bytes**, SHA-256
`5520b52e17373c75325fbcd058a128c0a8264f5178aa9d721a6d0c824307376f`.
All ZIP paths were checked before extraction, including traversal and symlink
rejection. Its **86 files / 3,800,414 bytes** were independently compared with
extracted bytes. The EXE was **730,024 bytes**, SHA-256
`574df6673f136d399ab16afc145ca1ebf2589772884f2f47ce18c016f0fa40c5`.
No mirror substitution, installer or larger media kit was used.

There is one canonical extraction at
`test/binaries/candidates/lmarbles-108/game/LMARBLES/`, plus the preserved ZIP in
the run. `recover-original.py`, `zip-verified.json` and `media-references.json`
provide the recovery recipe, member hashes and existing media references.
The required `.wine-assembly-browser.json` mounts all 86 members at their
canonical `C:\LMARBLES` paths. The registry's original EXE, no arguments,
`C:\LMARBLES` working directory and all eleven bundled DLLs were used unchanged.
The separate shared `test/binaries/dlls/msvcrt.dll` matched SHA-256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.
All 86 original member hashes and all 644 frozen input pins remained unchanged
at postflight. Runtime profile writes stayed in the native browser/VFS session;
they did not overwrite the canonical original files.

## Reviewed controls and full frames

Chrome reported `151.0.7922.108`. The complete viewport was **1024×712**, with
an unscaled **1024×684** desktop canvas, sufficient for the complete
**646×507** game window. New Game → Start was operated with balanced native
mouse input; the Original levelset, Normal difficulty and Michael profile
were visible before Start.

The Tutorial board and target were read from the public frame. `plan.py`
performed abstract slide planning over that transcription only; it neither
read nor wrote guest puzzle state. The target was blue/cyan above cyan/blue.
Coordinates were derived from the current frame: tile `(0,0)` centered at
canvas `(130,170)`, with 32-pixel tiles. Each changed marble selection used
motion to a visible empty tile, motion onto the actual marble, then a balanced
left press/release. Selection rings and settled consequences were reviewed.
The initial ring was also captured with the pointer moved away.

| Move | Marble | From → to | Arrow | Moves remaining |
| --- | --- | --- | --- | --- |
| 1 | blue | (2,1) → (4,1) | Right | 17 |
| 2 | blue | (5,6) → (4,6) | Left | 16 |
| 3 | blue | (4,6) → (4,2) | Up | 15 |
| 4 | blue | (4,1) → (1,1) | Left | 14 |
| 5 | blue | (4,2) → (6,2) | Right | 13 |
| 6 | cyan | (6,3) → (6,6) | Down | 12 |
| 7 | cyan | (6,6) → (4,6) | Left | 11 |
| 8 | cyan | (4,6) → (4,1) | Up | 10 |
| 9 | blue | (1,1) → (3,1) | Right | 9 |
| 10 | cyan | (3,3) → (3,2) | Up | 8 |
| 11 | blue | (6,2) → (4,2) | Left | 7; completion |

Key complete viewport screenshots, all personally reviewed:

- [Initial complete Tutorial board and target](../../scratch/runs/20261112-lmarbles-browser-tutorial-2240/live-review/software/tutorial-board.png).
- [Initial selection ring, pointer away](../../scratch/runs/20261112-lmarbles-browser-tutorial-2240/live-review/software/selected1-away.png).
- [First browser move, Moves 17](../../scratch/runs/20261112-lmarbles-browser-tutorial-2240/live-review/software/move1.png).
- [Before the final move, Moves 8](../../scratch/runs/20261112-lmarbles-browser-tutorial-2240/live-review/software/move10.png).
- [Final blue marble selected](../../scratch/runs/20261112-lmarbles-browser-tutorial-2240/live-review/software/selected11.png).
- [Final slide consequence and native completion animation](../../scratch/runs/20261112-lmarbles-browser-tutorial-2240/live-review/software/move11-clear.png).
- [Native completion tally, Total Score 1350](../../scratch/runs/20261112-lmarbles-browser-tutorial-2240/live-review/software/completion-outcome.png).
- [Next native puzzle, Tier 1 Puzzle 2 / Score 1350 / Moves 28](../../scratch/runs/20261112-lmarbles-browser-tutorial-2240/live-review/software/next-level.png).

## Identity, validation and capacity

Tested source commit: `2aec10f07161f00a42a710f18dfb05bf7f59822e`.
The recovered actual CPU Worker module matched the existing 2,189,863-byte
build, SHA-256
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Capture bindings checked the process, Worker endpoint/slot, live instance and
memory ownership, actual module bytes, renderer/canvas objects and native HWND.
The applicable publisher was the window's **actual canonical GDI presentation**,
with matching target HWND, uploaded pixels and positive write sequence. No
invented GL context fields were required. CPU slice sequence advanced
**429 → 136106**, with positive retired blocks in the retained native bindings.

Validation passed for **45 complete viewport captures**, **18 retained full PNGs**
with strict CRC/decode checks, and their actual native owner bindings. All
**22 input pairs** had independent release owners armed before DOWN; each
release was acknowledged, and each release parent exited 0 with both streams at
EOF. Native gameplay, completion and continuation were visually reviewed.
There are no GPU, parity, FPS, audio or full-game completion claims.

Low local disk capacity interrupted the run before the final selection; the
refusal occurred before API/input submission. The two specifically authorized
obsolete 0.167.1 components were recovered losslessly, with stable current
0.167.2 selection, privileged preflight and pre-unlink no-consumer/no-writer
checks, exclusive installer locking, full raw/encoded hashes, fsynced encoded
bytes and directory, an independent whole decoder roundtrip, and durable
exclusive restore recipes/journals before unlink. Recovery metadata remains
local beside those components and in this run. **All previously compressed
0.167.1 components must be restored before any future selection of that
release.** No other cache component, reserve, selector or RAM setting changed.

Concurrent disk use required further cleanup of this run's completed logs and
transient pointer PNGs. Every movement consequence, initial ring, menu, board,
completion and next-puzzle frame was retained. `key-full-captures-final.json.xz`
holds the exact original PNG bytes for the earlier key frames, individually
hashed and fully roundtrip-verified; it contains no source or media archive.
Pointer-frame discard and state-compression journals identify the optional
transient views that were reviewed and then removed. Fresh frames preceded
resumed input, and all new game input required actual free space above
1,500,000,000 bytes. This is not a continuous free-space claim.

## Recovery and shutdown

`closed-unique-outputs.json.gz` retains 289 unique log/receipt contents and the
335-path output inventory, with independent remote rereads and local SHA checks.
Existing pinned modules and media were referenced rather than copied again.
`retrieval-verified.json` and `validation.json` record the checks. Git commit,
relevant binary diff, relevant untracked source patch and owned helper/note
patches provide source recovery without a source-tree archive.

Fresh private box **`bx_23udbfdy`** had an observable independent two-hour
watchdog armed **before creation**. All 646 staged paths were remotely verified,
and the actual provision parent exited 0 with both streams at EOF before the
original launched. After the outcome was retrieved, the owned browser closed
normally: Chrome and its original parent exited 0 with both streams at EOF.
This was browser closure, not an asserted in-game Quit sequence.

The box was normally **archived at 2026-11-12T22:49:18.584Z**, expiry cleared
(`archiveAfter: null`). Receipt **`stop_7a5872d12ee8a755`** is completed,
`forced: false`, `error: null`. The watchdog recorded terminal confirmation.
The local manager and watchdog **parent wait/EOF records remain UNKNOWN**:
tool session 99508 returned 143, those wait records were absent, and no owned
lifecycle process remained at postflight. These unknown joins are distinct from
the verified browser/provision waits and normal box stop.

No engine defect was inferred or patched. The requested first Tutorial clear
is complete; further puzzles and full-game completion remain untested.
