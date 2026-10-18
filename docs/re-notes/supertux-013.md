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
