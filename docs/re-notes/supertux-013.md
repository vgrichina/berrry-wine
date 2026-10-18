# SuperTux 0.1.3 — original Windows source readiness

2026-10-18, source-only new-game refill. No build, native guest, browser,
installer execution, or licence-dialog response was performed.

## Original provenance and recovery

The project's [v0.1.3 release](https://github.com/SuperTux/supertux/releases/tag/v0.1.3)
publishes `supertux-0.1.3-setup.exe` (7,623,968 bytes). The historical
[official download wiki](https://github.com/SuperTux/supertux/wiki/Download%252FStable)
also identifies that Windows filename. Download directly from:

```
https://github.com/SuperTux/supertux/releases/download/v0.1.3/supertux-0.1.3-setup.exe
```

Observed SHA-256:
`bc4893dbb84a02beb8958dab1c922a7f715aa08ed463d2a0efa6bc58d79c9a9b`.
The release API supplies no upstream digest; this is an observed identity,
not an independently published checksum. `file` and `innoextract` identify
Inno Setup 4.2.2, not NSIS. `7z l` failed without changing the source.

Retained directory on the coordinator:
`/home/user/wine-assembly/scratch/runs/20261018-supertux-source/`.
It contains the installer, archive-list.txt, extraction.log, inventory.json,
and extracted/app. Recovery requires only the pinned official installer and:

```
innoextract -d extracted supertux-0.1.3-setup.exe
```

Extraction produced 787 files, 16,107,101 bytes, with no installer execution.
The whole retained evidence occupies approximately 25 MiB. Original EXE:
`extracted/app/supertux.exe`, SHA-256
`5930d9848beec72fcaea0687d745e1c9fc148245abbf3f856c208ed41d83265c`.
`inventory.json` records every file's path, byte count and SHA-256.

## Closure and selection

`objdump -p` checked the EXE and all six bundled DLLs: SDL.dll,
SDL_image.dll, SDL_mixer.dll, jpeg.dll, libpng1.dll, zlib.dll. Every non-system
import DLL is present. System imports are KERNEL32, MSVCRT, OPENGL32, WINMM,
USER32, GDI32, ADVAPI32 and CRTDLL, all classified in current
`lib/dll-loader.js`. This establishes file closure, not implemented API or
runtime compatibility. No missing payload path is currently known.

The original doc/COPYING is GPL version 2; doc/README describes the game and
controls. No commercial activation or unanswered installer licence was
encountered. Source-only extraction is the proposed launch preparation.
This is not permission to publish a distribution.

Current-main registry/TODOS and the shared historical messageboard contain
no SuperTux title/qualification. It is absent from DESKTOP_APPS. The previous
refill report's already-qualified pool was preserved; SuperTux is a fresh
title, not an alternate renderer of a qualified game.

## Next ordinary action

Use the adjacent `../supertux-013-launch.json` packet after the coordinator
grants the serialized runtime slot and pins current launcher source/module.
Launch the original executable with its entire extracted app tree and its
own `--sdl --datadir data` options, which occur in original EXE help strings.
Do not disable sound/music or alter game data. First 60-second passive CLI
run should establish the actual startup/menu or first fail-fast error.
Use the CLI internal wall-clock bound plus an 85-second last-resort owned
process guard, 8 MiB output ceiling and >2 GiB disk floor. Preserve outputs,
exit receipts and unchanged original hashes before releasing the slot.

Then inspect the actual menu before selecting Start Game using normal
input. README documents arrow-key world-map navigation and Enter to enter
a level, left/right movement and Esc for the menu. Confirm jump/run bindings
in Options rather than guessing. Qualification needs reviewed actual level
movement against idle/opposite input, not the menu or a screenshot alone.
Browser, audio quality, FPS and full gameplay remain untested.

## First passive launch, 2026-10-18 16:47Z

Root granted one passive original launch on source
`b9c3480021a6d4ab696edc22ea50e08cd592da1b`, module
`9bf6051774ad0ebe29744e7ade39d902b4f4716661cf9d8e36c2a24b06ae2a29`.
Preparation and evidence are respectively
`scratch/runs/20261018-supertux-launch-prep` and
`scratch/runs/20261018-supertux-passive-startup` on the coordinator.
The controller explicitly mounted all 787 original files at C:\\SUPERTUX,
set that working directory, and used `--sdl --datadir data`. Source pins
covered 3,115 files with no missing selected paths. Bounds were 60 seconds
guest / 85 seconds hard, 8 MiB output, 2 GiB + 128 MiB disk admission and
2 GiB + 64 MiB early stop. No guest input or installer was executed.

SDL's original DllMain returned success, then batch 1 stopped at
`UNIMPLEMENTED API: setbuf`, EIP `0047e1b0`, return `0046dbeb`.
Crucially, the loader first warned three times that the real `msvcrt.dll`
was absent and imports fell back to WAT handlers. This run therefore does
not establish an emulator setbuf defect with the intended runtime closure.
There was no PNG or window/menu evidence before the failure.

Exact missing runtime fixture:
`/tmp/wa-recovery-20261014/test/binaries/dlls/msvcrt.dll`.
An existing corpus file is available at
`/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll`, 278,581 bytes,
SHA-256 `887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.
Static objdump confirms it exports `setbuf` and imports only KERNEL32.
`lib/dll-registry.js` expects this real DLL. Next action is to stage and pin
that existing corpus dependency, verify real-PE selection, and prepare a
separately granted passive launch. Do not implement a silent setbuf stub
based on the incomplete runtime route. The game payload itself is complete.

Child 2191303 and controller 2191286 exited; child returned code 1 without
a signal at 16:47:46.557Z, approximately 140 ms after spawn. Controller
detected crash text and requested quit, without a hard timeout or guard kill.
Output was 5,797 bytes; minimum sampled free disk was 3,536,146,432 bytes.
All 3,115 source and 787 original fixture pins remained unchanged. Worker
independent postflight confirmed no owned process group; both PIDs were
also absent in a separate `ps` check. Root independently verifies release.
No retry, build, browser, gameplay, audio or FPS claim.

## Complete real-DLL route, 2026-10-18 16:54–16:56Z

Two subsequent runs were separately granted by root. First restored the
existing corpus MSVCRT file to the exact missing integration path, without
overwriting a differing file. The original game tree stayed untouched.
`20261018-supertux-crt-startup` confirms actual MSVCRT mapped at `0070b000`,
both DLL initializers returned success and setbuf passed. It then failed
at `Mix_OpenAudio`, EIP `0046d3d0`, return `0043b9c7`, before drawing.
Child 2197313 exited 1 without signal in approximately 157 ms; controller
2197303 and child were independently absent. All 3,116 source/runtime and
787 original pins remained unchanged; disk minimum 3,532,296,192 bytes.

Source audit found that normal EXE discovery filters DLL names through
`lib/dll-registry.js`: SDL is listed, but SDL_image/SDL_mixer/jpeg/libpng1/zlib
are not. A VFS mount does not declare a DLL for static PE loading.
`test/run.js` supports repeated `--dll-seed=NAME`, passed to shared
`resolveDllGraph`; explicit seeds bypass only that discovery-name filter.
Pure-JS graph replay reproduced automatic `[sdl.dll, msvcrt.dll]` versus all
seven real DLLs when the six originals were declared. No production source,
API stub, sound-disable switch or alternate DLL was introduced.

The corrected route adds these arguments to the original packet:

```
--dll-seed=SDL.dll --dll-seed=SDL_image.dll --dll-seed=SDL_mixer.dll
--dll-seed=jpeg.dll --dll-seed=libpng1.dll --dll-seed=zlib.dll
```

Fresh preparation: `scratch/runs/20261018-supertux-dll-launch-prep`.
Fresh run: `scratch/runs/20261018-supertux-dll-startup`, source
`8c2b5bf6127333ffd5e450c8585b2d70863fd70d`, same module `9bf60517…`,
3,117 source/runtime pins including the restored CRT, same 787 originals.
The log confirms all seven actual DLL mappings and EXE/cross-DLL patches.
Reviewed sample-0.png visibly shows the SuperTux main menu (Start Game,
Bonus Levels, Options, Level Editor, Credits, Quit). Main-menu reachability
is established; no gameplay input was sent. Root must grant the next normal
Start Game/world-map/level navigation and reviewed input comparison before
this title can qualify as player-controlled gameplay.

Final.png also reviewed: same main menu with naturally animated background.
Child 2198516 exited 0 without signal at 16:56:09.968Z, approximately
60.189 seconds after spawn; controller 2198506 exited 0. Both independently
absent; worker independent postflight has no owned survivors and all pins
unchanged. No hard kill or disk/log guard fired. Minimum free disk was
3,525,369,856 bytes and output 1,167,194 bytes. Valid result.json records
only main-menu success. Evidence checker has no new invalid/missing records;
its sole containment error is the unrelated historical Zuma run.

## Ordinary level input, 2026-10-18 17:00–17:03Z

Root granted a fresh interactive CLI run, 180 seconds guest / 210 seconds
hard, with the same 8 MiB log and disk guards. Source was
`e33cf8735212c944b96e25f53923774219dc8e61`, unchanged `9bf60517…` module,
3,117 source/runtime pins and 787 original files. Preparation is
`scratch/runs/20261018-supertux-gameplay-prep`; complete evidence is
`scratch/runs/20261018-supertux-gameplay`. Atomic numbered JSON requests
fed ordinary CLI keydown/keyup commands, with independent host timers
releasing each held key after 100–201 ms. Before/held/released PNGs were
requested for every hold. No game file, memory or clock was changed.

Reviewed normal route: Enter on Start Game; Enter on Slot 1; inspect the
world map; Down to its first red node, labelled "Welcome to Antarctica";
Enter into that level. An earlier Enter on the starting white node did
not enter a level. `level-ready.png` shows the actual platform level.

`level-right-before.png` shows Tux at approximately x115 near the starting
grass patch. During ordinary Right (200 ms), `level-right-held.png` shows
Tux around x255 while the world camera has advanced substantially: the
initial question blocks have scrolled left and new foreground appears.
`level-left-before.png` later shows Tux back near x115 on the starting
ground; ordinary Left (200 ms) turns him left and moves him to the left
edge in `level-left-held.png` and `level-left-released.png`, against the
same fixed nearby scenery. These establish scoped directional response
in actual gameplay, not just movement in the animated title background.

Limits matter here: the default batch-derived CLI clock advances the
level timer quickly during agent think-time. Timeout/respawn occurred
between observations, so this is not a clean same-life opposite/idle
comparison. `released-idle.png` reset to the starting position and is
rejected as an idle baseline; `short-right-*` was already back at the
main menu and is excluded. No jump key was sent; the airborne pose in
right-released is not jump evidence. No logical FPS or audio measurement.
`review.json` lists the exact 17 images inspected and these limitations.

Eight host keydown/keyup pairs are balanced in `issued.ndjson`; all release
timers fired. The trace window suppressed later CLI control replies, so
recorded host times are publication times, not individual guest execution
acknowledgments. The causal visual changes provide input-response evidence.
Child 2204602 and controller 2204591 both exited 0 after requested normal
quit at 17:03:14.063Z, 135.401 seconds after spawn. Both independently absent,
owned group empty, all pins unchanged, no guard kill; minimum free disk
3,494,961,152 bytes, output 1,165,523 bytes. Root independently reviews the
evidence before qualification. Original failed/menu-only runs are preserved.

Next durable product step is a local-only registered route declaring these
same six DLL seeds and original file manifest. Sustained control should use
a separately measured suitable CLI clock or ordinary browser timing;
changing clock parameters during this evidence run was not authorized or
performed. Jump bindings, complete controls, physical touch, audio and FPS
remain separate follow-ups. No public deployment.
