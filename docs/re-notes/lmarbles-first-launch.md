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
