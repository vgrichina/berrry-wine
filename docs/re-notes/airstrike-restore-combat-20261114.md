# Original Airstrike restored, visible combat and native Quit — 2026-11-14

**The exact original closure is restored, and fresh unobscured combat and
native menu Quit were observed.** Production verification passes all **89
files / 4,072,418 bytes / 88 companion mappings**, before execution and after
both runs. The fixture is again available at
`test/binaries/candidates/airstrike-pre6a/`. No emulator or registration code
changed. Downloads and extracted media remain outside the run directory and
outside Git.

Evidence: `scratch/runs/20261114-airstrike-restore-combat/result.json`, its
selected PNGs, compact command/receipt JSON, and complete small runtime logs.
All selected PNGs were inspected. The decisive fresh run is in `fresh/`.

## Exact recovery

Only the two expressly authorized official URLs were downloaded, with HTTPS
certificate checking, no redirect/provider fallback, bounded time and size:

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| `https://icculus.org/airstrike/airstrike-pre6a-win32.zip` | 2,730,549 | `c611d1f269d2794920be7e715c40f251f93484b4ad00c399b4a9b8379aa2f662` |
| `https://www.libsdl.org/projects/SDL_image/release/SDL_image-1.2.3-win32.zip` | 160,219 | `e7f817604519192ee1be33f66190864898baf81fc87c36ff60e05f71e1901e14` |
| Unchanged supplier `zlib.dll` | 53,760 | `0df0c22bf411ad670d7b8fe5a533e4831313d5a3118cf9216389c642c90ec2f9` |
| Standing `test/binaries/dlls/msvcrt.dll` | 278,581 | `887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1` |

Archives, the selected original release tree and zlib are retained at
`test/binaries/media/airstrike-original-20261114/`. Both ZIP CRC checks
passed. Every selected original member was checked against the committed
inventory before writing it. The inventory itself matches SHA-256
`e7e62dd423c604effd0f747ea3f3c63ff445ee698b0755b52312b077ea481d75`.
The standing CRT matches the actual inventory pin; no provider substitution,
rename, rebuild or media conversion was used. One acquisition-receipt script
initially failed on a duplicate Python dictionary keyword after checking the
CRT; the corrected receipt was written separately. Production preparation and
verification independently passed.

The recovery recipe uses a fresh destination and these exact retained inputs:

```sh
node tools/verify-airstrike-pre6a.js --prepare \
  test/binaries/media/airstrike-original-20261114/release \
  test/binaries/media/airstrike-original-20261114/zlib.dll \
  test/binaries/dlls/msvcrt.dll \
  test/binaries/candidates/airstrike-pre6a
node tools/verify-airstrike-pre6a.js test/binaries/candidates/airstrike-pre6a
```

For reacquisition, retrieve only the exact URLs above into a fresh media
directory, verify the archive hashes and CRCs, extract only members named by
the inventory with `source: "original"` after stripping `airstrike-pre6a/`,
and extract the supplier's unchanged `zlib.dll`. Verify every member's size
and hash before preparation. Existing fixtures must not be overwritten.
The committed verifier remains the authority for all bytes and mappings.

The release's own `doc/airstrike.6` was read directly from the original ZIP;
its controls section is retained as `original-controls.txt`: comma accelerates,
Right/Left turn, period shoots, Space drops a bomb, and Escape opens the menu.
Original `airstrikerc`, all data and sounds remain byte-identical: 800×600,
windowed, alpha2, sound1, one human against the default AI. No source archive
or additional supplier was acquired.

## Fresh visible play and Quit

The decisive run used the production registered `--app=airstrike_pre6a` route,
empty game arguments and original cwd, an existing pinned Wasm module,
`--no-close --real-ticks --no-threads --batch-size=20000`, live ordinary input,
and **`--screen=1024x768` before startup**. Its wall-time guard was 160s and
its independent observable watchdog was armed for 185s before launch.
No guest memory, game config, clock, AI or score was edited. `--no-threads`
uses cooperative guest scheduling; the original audio guest thread was still
created and exited. Sound was enabled; audible output was not assessed.

The host initially opened the Console over the game. A titlebar drag moved it
to x850, beyond the game's right edge x826. Clicking the visibly exposed game
correlated focus and main HWND `0x10001`. The fresh startup PNG shows the
complete game area and “Press any key to start”; independently released Enter
started the game. No host-window resize was used in this decisive run.

Selected full-desktop PNGs and actual settled batches:

| PNG in `fresh/` | Batch | Observed result |
| --- | ---: | --- |
| `unobscured-start.png` | 35,668 | Full original scene, startup text, Console aside |
| `before-controls.png` | 38,238 | Blue plane near (340,583), ground combat, score 00–00 |
| `firing-movement.png` | 39,207 | Blue plane near (631,541), changed orientation/trajectory and white trail; black projectiles in front of it, explosions, score 01–00 |
| `post-release-combat.png` | 40,735 | Continuing projectile/combat scene and blue plane near (600,571), after all gameplay key releases |
| `native-menu.png` | 42,339 | Entire actual menu, star beside Resume game, score 02–00 and combat wreck/effects |
| `quit-selected.png` | 50,906 | Entire actual menu, star beside Quit game |

Comma was down at 38,920 and independently released at 39,928 (12s bound).
Right was down/up at 39,025/39,079 (0.55s). Period was down/up at
39,091/39,747 (8s). Separate release processes were armed before each keydown;
their parents actually waited for them and drained both output streams.
The postrelease capture is 807 batches after the last gameplay release.
These are visual observations of ordinary human controls during real combat,
not merely input ACKs. Explosions, wrecks and score changes demonstrate combat
consequences; no particular kill is attributed to the human's bullets.

After all gameplay keys were released, Escape down/up at 42,161/42,271 opened
the freshly inspected seven-row menu. Its actual labels were Resume game,
Players setup, Toggle fullscreen, About the game, Release notes, Toggle debug
mode and Quit game. One Up down/up at 50,675/50,831 wrapped from the observed
Resume row to the observed Quit row. Only after inspecting the star beside
Quit did Enter down/up at 65,394/65,431 select it. There was no blind Down
chain, control-channel quit or WM_CLOSE.

The complete log records **`[Exit] code=0`**, 65,649 batches and **94.137s**.
The runner actually exited0, both stdout/stderr reached EOF, its cooperative
thread exited, and its process group was absent. The watchdog exited0 after
the done marker; it did not fire. The heavy-runtime lock was released.

## Diagnostic first run and validation limits

The first run omitted `--screen`; the host's initial 640×480 desktop caused
the primary DirectDraw surface to be 640×480 while the game's native drawing
surface was 800×600. Increasing the desktop after creation, attempted titlebar
minimize/maximize and an ordinary host resize did not repair that existing
primary. A malformed `drag` command was rejected without delivery, then
explicit mouse down/move/up performed the titlebar drag. These diagnostic
actions are retained, not replayed into the decisive run.

Read-only captures of the first run's actual 800×600 drawing surface exposed
the clipped native menu and its selected Quit row. They are explicitly
offscreen captures, not proof of an unobscured presented combat frame. That
run also quit normally: `[Exit] code=0`, 257.346s before its 260s guard,
runner0/bothEOF/watchdog0/no residual group. Setting the host desktop before
the second launch resolved the presentation prerequisite without production
changes. The second run supplies the full composited evidence above.

Both runs loaded Wasm SHA-256
`c7f5bada4da4b4ed95b235add0aa1c9843176805d29d5b1ee79359752a19d348`
(2,199,488 bytes). First-run inspected Git HEAD was
`7a08e02858395b1b4c7e405fafef070d72cb4453`; fresh-run HEAD was
`85d1ddc92217807757bbebe718be01317940d6bf`. Their source hashes and relevant
uncommitted binary diffs, including untracked runtime-file patches, are retained
in each run directory. Foreign WIP was preserved, neither edited nor adopted.
These identify the tested existing module and runtime source; they do not
claim a newly successful build from those dirty revisions.

Validation passed: real-input registration acceptance including all 89
missing-file controls, corrupt identities and mapping/seed/source/overwrite
rejections; six existing menu-controller test groups; the independent deadline
kill/wait/EOF control; the independent key-release transport control; and final
production verification after both runs.

The required full-build **attempt failed**, under both
`wine-heavy-runtime.lock` and `wine-build.lock`, at foreign TIM-owned ToyVM
browser bundle freshness: 2,651,545 retained bytes versus 2,651,735 source
bytes, first differences 801,005 and 853,049. `build.log` preserves the exact
gate. No full-build PASS or production code commit is claimed. TIM subsequently
announced its own regeneration/build success; that is not counted as this
worker's test. This publication commits only this report.

All 89 fixture files verify unchanged after the final exit. No box was
created: ID none, state `NOT_CREATED`, expiry null, stop receipt not applicable.
Owned runtime/watchdog/release processes are gone; no runtime is retained.
The assigned restoration/combat/native-Quit task is complete; no further
gameplay or repair is pending here.
