# LMarbles 1.0.8 Win32: original package and proposed launch

Source-only inspection, 2026-10-18. No installer execution, guest run, build,
browser session or gameplay qualification occurred. Root owns runtime admission
and the new-game ledger.

This is Michael Speck's LGames Atomix-style puzzle game, **not** the public
Microsoft Plus!98 marble-solitaire app `marbles` (`plus98/MARBLES.EXE`). Registry,
candidate manifest, TODO, re-notes and messageboard searches found no existing
LMarbles/Atomix qualification. Public DESKTOP_APPS was inspected; the similarly
named Microsoft game is documented in `docs/re-notes/marbles.md`.

## Original package and recovery

- Developer page: https://lgames.sourceforge.io/LMarbles/
- Original package: https://downloads.sourceforge.net/project/lgames/lmarbles/lmarbles-1.0.8-win32.zip
- Listing: https://sourceforge.net/projects/lgames/files/lmarbles/
- ZIP: 1,753,947 bytes, SHA-256
  `5520b52e17373c75325fbcd058a128c0a8264f5178aa9d721a6d0c824307376f`.
- 86 original files, 3,800,414 bytes unpacked. ZIP integrity/extraction succeeded;
  every extracted file was independently compared byte-for-byte with its ZIP
  member and its recorded SHA-256. Paths and aggregate size were checked before
  extraction. No original file was modified.
- Evidence: `scratch/runs/20261018-lmarbles-source/` holds the ZIP,
  `archive-listing.json`, `source-manifest.json`, `pe-closure.json`,
  `verification.json`, all twelve PE import reports and `original/`.
- Actual game directory:
  `scratch/runs/20261018-lmarbles-source/original/lmarbles-1.0.8-win32/`.

Recover by downloading that exact ZIP, checking its SHA-256, inspecting the ZIP
paths and expanded size, then extracting the complete directory. Keep the ZIP
and extraction together below 50 MB retained and require at least 2 GiB free
after each operation. The official page advertises an installer-free Win32
port; no installer or license-answer flow is needed. `COPYING.txt` contains GPL
version 2; the bundled manual identifies the game as released under GPL. This
inspection is not public-distribution or deployment approval.

## Executable and dependency closure

`lmarbles.exe`: 730,024 bytes, SHA-256
`574df6673f136d399ab16afc145ca1ebf2589772884f2f47ce18c016f0fa40c5`.
It is PE32 i386, GUI subsystem version 4.0, image base `0x400000`, entry RVA
`0x14b0` (original VA `0x4014b0`). It imports KERNEL32, MSVCRT, SDL and SDL_mixer.

The ZIP includes eleven original i386 DLLs: `SDL.dll`, `SDL_mixer.dll`,
`iconv.dll`, `libFLAC-8.dll`, `libgcc_s_sjlj-1.dll`, `libintl-8.dll`,
`libmikmod-3.dll`, `libogg-0.dll`, `libvorbis-0.dll`, `libvorbisfile-3.dll`,
and `libwinpthread-1.dll`. Recursive static imports resolve within this set
except ADVAPI32, DSOUND, GDI32, KERNEL32, MSVCRT, USER32 and WINMM.
Those system APIs still require actual emulator support; static closure does
not prove successful initialization, dynamic-library resolution or gameplay.

MSVCRT is not bundled. The authentic shared file already exists at
`test/binaries/dlls/msvcrt.dll`, SHA-256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.
Use it as a separately identified runtime dependency, not as an original ZIP
member. No other missing third-party DLL was found in the static import closure.
All original graphics, sounds, `levels/Original`, manual and license are present.

## Next launch and ordinary controls

Proposed first run: mount the complete original game directory with its
directory as guest CWD (for example `C:\LMARBLES`), launch `lmarbles.exe` with
no arguments, and make all bundled DLLs plus the identified shared CRT
available. No registry/manifest registration or runtime command has been tested.
Keep original bytes pinned; any generated profile/config belongs to runtime
state, not reconstructed original assets. EXE strings reference relative `gfx`,
`sounds`, `levels` and `lmarbles.prfs` paths.

The original manual documents New Game → Start, the Original levelset, and an
initial profile named Michael. These are documentation, not observed menus.
Select a marble with left click; then use cursor keys to move it, or point in a
direction and left click after the pointer becomes an arrow. Right click
deselects. Space undoes a move unless a crumbling wall was hit; P pauses.
Escape requests quit, with Y/N or left/right click for confirmation. Inspect
the actual initial scene before choosing input coordinates or timings.

First runtime evidence should establish ordinary startup and clean termination;
after root review, demonstrate a selected marble moving under ordinary input
and capture a settled board. No runtime slot is claimed by this source task.

## Passive original launch, 2026-10-18

The subsequent root-authorized 60-second passive CLI run reached the original
LMarbles 1.0.8 main menu: New Game, Best Profiles, Options and Quit. No input was
sent and no gameplay was tested. All seven captures (six observations and final)
are byte-identical SHA-256
`2f9b1e1b507c545c9adca16a536e140e92059c6519f3fece0fcb08a5338e2c59`;
the menu was personally reviewed in samples 0, 1 and 5.

Evidence: `scratch/runs/20261018-lmarbles-passive-startup/`, with `review.json`
published last because no candidate registration exists yet. `launch.json`
records the exact command: all 86 original files mounted at `C:\LMARBLES`,
empty guest arguments, eleven original DLL seeds and authentic shared MSVCRT.
The cooperative real-tick CLI used the existing canonical module SHA-256
`a4a4bc6aef0f50a191d83acdd0857ff390537701adc381d81436845f20b969e3`.
Source HEAD at launch was `c1cefbd7299a3238440cdc3c86d05e9073b432cb`;
postflight HEAD was `348febabcb2baef4632f1e30eb2aa9f18b631833`, with all 3,192
physical runtime-source/CRT pins unchanged. All 86 original hashes also passed.

Child 2304184 and controller 2304174 exited 0 at 18:33:44.705Z after 60.162
seconds wall time; the CLI reports its ordinary max-seconds termination at
60 seconds. This was host-bounded observation, not an in-game Quit test.
Separate process inventory confirmed both absent and the owned group empty.
No guard fired: log 13,102 bytes, minimum observed free space 2,530,099,200 bytes.
Admission required 2 GiB plus 128 MiB; early stop retained a 64 MiB margin,
with an 8 MiB log cap and 85-second hard bound. No build or browser ran.

Next is root-reviewed ordinary New Game activation and actual marble selection
and movement, on a separately admitted runtime. Startup success does not
establish gameplay, input, audio, FPS, browser support or public release.

## Registered Tutorial board; marble control unverified

The separately admitted registered run
`scratch/runs/20261018-lmarbles-registered-gameplay/` used
`--app=lmarbles_108` on source `8eacf0d976dddd10bb21d1fbd5611a55b9bce1bf`
and the same canonical module. Registry CWD, executable guest path, empty
arguments, twelve DLL seeds, 86 original files and 85 companion mappings were
verified before launch. Real-time clock and cooperative CLI were retained.

Ordinary 250 ms mouse presses on New Game (278,304) and then Start (278,267)
reached the original Tutorial board with profile Michael, Normal difficulty and
18 moves. `start-settled.png` was personally reviewed. The game window resized
to 646x507 at (20,20), exceeding the 640x480 capture surface; right/bottom edges
are clipped, so this does not verify the complete HUD.

Mouse selection attempts at the visible upper blue marble (194,202) and central
green marble (226,266), with an intervening ordinary pointer movement, followed
by Right presses of 100 and 250 ms produced balanced host down/up acknowledgments
but **no visible marble displacement or move-counter decrement**. Later settled
board captures are byte-identical SHA-256
`fa710b8e4afd04a6334cc0037540e1541c915f3d8c61a483e59960ae9005618c`.
Selection itself was not visually established. The final pointer movement to
the legal tile right of the green marble showed no selection arrow; no blind
direction click or forced state was attempted. Input delivery to game logic
and the cause of unchanged state remain unknown.

The run ended by ordinary host quit after 103.446 seconds. Child 2316562 and
controller 2316546 exited 0 at 18:45:17.488Z; independent inventory found both
absent and the owned group empty. All 3,279 source/fixture/CRT pins and 86
original hashes remained unchanged. Seven key/button pairs were independently
released. No guard fired: minimum free space 2,574,659,584 bytes, log 23,939 bytes.
`result.json` was published last as reviewed outcome `unknown`, candidate
`lmarbles-108`, app `lmarbles_108`, retaining menu/board progress and the failed
control criterion. No gameplay-control, audio, FPS, browser or full-game claim.
Next work should audit original selection/input coordinates before any newly
admitted runtime; repeating the same unchanged-board inputs is not evidence.

## Source audit: selection is gated by prior motion classification

No coordinate correction is justified by the retained trace. CLI mouse actions
accept canvas coordinates. `renderer-input.js` subtracts the HWND client origin
for mouse-message lParam; `wnd_mouse_msg_origin_x/y` and ScreenToClient both use
the same `wnd_client_screen_x/y` helpers. The observed window origin (20,20),
border/caption and log establish client origin (23,43): blue canvas (194,202)
became client (171,159), packed `0x009f00ab`; green (226,266) became (203,223),
packed `0x00df00cb`. Both conversions pass exact arithmetic checks. Screenshot
clipping does not itself move these visible marble centers.

Static disassembly of the pinned original EXE establishes a more useful
discriminator. All following addresses are original VAs (image base 0x400000):

- Gameplay polls SDL events at `0x4035c9`; event dispatch starts `0x4035d6`.
  Jump table `0x420564` maps type 3 to keyboard handling, type 4 to motion
  `0x403a48`, type 6 to mouse-button handling `0x403985`, and ignores type 5.
  These are SDL1 key-up, mouse-motion, button-up and button-down respectively.
- Mouse motion calls tile classifier `0x40808f`. It computes tile coordinates
  from board origin `0x4233c4/0x4233c8` and tile size `0x4233f8/0x4233fc`;
  a marble hit sets cursor mode `0x423428` to 1 at `0x408194`.
- Left-button release calls selection `0x405dca` only when that cursor mode
  already equals 1 (`0x4039ce` comparison; call `0x4039f0`). The button event's
  own coordinates do not first reclassify the cursor. Selection writes flag
  `0x423348=1` and selected tile `0x42334c/0x423350`.
- Arrow handling is gated on selected flag (`0x4037dd`), with movement state
  `0x423368` and legal-direction mask `0x423370` checked before starting a move.
  Balanced key-up is necessary; key-down alone is not the game's action edge.

The first board click lacked prior motion. The later explicit motion was to
the same point already used by a mouse-button event. SDL suppression of that
same-point motion is a plausible explanation, **not established causality**.
The retained log proves a Win32 WM_MOUSEMOVE was offered, not that the game
received a corresponding SDL motion event. This distinction also explains why
host acknowledgments cannot establish selection.

Concrete next discriminator, only after a new runtime grant: retain a positive
count at `0x4035c9`, count motion `0x403a48`, button-up `0x403985` and selection
`0x405dca`; read the above small state fields before/after ordinary movement
from a reviewed empty board tile onto a reviewed marble, then a balanced click.
Confirm actual SDL motion/cursor-mode 1 and selected flag/tile before one arrow
release. If motion never reaches the game, investigate event delivery; if its
coordinates differ, inspect actual event x/y at the dispatch boundary; if mode
1 and button-up arrive but selection does not, inspect the explicit gate.
Do not compensate coordinates blindly or write guest state. Evidence and
disassembly are in `scratch/runs/20261018-lmarbles-input-source-audit/`.
This audit ran no guest, build or browser and changed no engine code.
