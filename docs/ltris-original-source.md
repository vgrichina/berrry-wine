# LTris 1.2.8 original Win32 source readiness

2026-10-18: source acquisition only. No guest/native runtime, build, browser,
installer, licence answer, gameplay qualification, or public deployment.

## Original package and recovery

Official URL: https://downloads.sourceforge.net/project/lgames/ltris/ltris-1.2.8-win32.zip

Archive: 2,379,795 bytes; SHA-256
`b64a817fd4031e5f3e0b31bad546b0876ac62ef6c6384eae396b2de127718622`.

Evidence root on Boat: `/home/user/wine-assembly/scratch/runs/20261018-ltris-source/`.
Original root: `original/ltris-1.2.8/`. Forty files, 7,361,674 bytes;
each extracted file was compared byte-for-byte by SHA-256 with its ZIP member.
`source-manifest.json` records all exact paths, sizes and SHA-256 pins.
`archive-listing.txt`, `pe-closure.json`, `verification.json`, `passive-plan.json`,
and the small JS acquisition/inspection scripts retain the recovery recipe.
Ignored payloads are not preserved by this documentation commit: recover using
the official URL, verify the archive pin, then extract without modification.

`COPYING.txt` is GPL version 2. The README describes SDL and optional SDL_mixer;
no installer or licence prompt was run. The original `ltris-window.bat` specifies
`ltris.exe -w`; fullscreen batch specifies its own launch option. Use the original
windowed option for the first passive launch.

## PE and data closure

`ltris.exe`: 572,618 bytes, SHA-256
`577c7fbdd026825ab50fe6009eab031f364f75aa8eb35253c91c82bf16e3a7d1`.
PE32 i386, image base 0x400000, entry RVA 0x13e0. Imports SDL.dll,
SDL_mixer.dll, KERNEL32.dll and msvcrt.dll.

Eleven original PE32 DLLs are bundled: SDL.dll, SDL_mixer.dll, iconv.dll,
libFLAC-8.dll, libgcc_s_sjlj-1.dll, libintl-8.dll, libmikmod-3.dll,
libogg-0.dll, libvorbis-0.dll, libvorbisfile-3.dll and libwinpthread-1.dll.
All non-system transitive DLL imports are supplied except the CRT, for which
existing authentic `/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll`
is available: 278,581 bytes, SHA-256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.
System imports are ADVAPI32, GDI32, KERNEL32, USER32, WINMM and DSOUND.
This is static closure, not a claim that every imported API works at runtime.

The JS PE reader records each imported symbol. Its eleven DLL import tables
agree with independent objdump output. objdump rejects the unmodified EXE;
`file` recognizes its PE32 i386 headers and the JS reader resolves its import
table. Preserve this tool limitation rather than rewriting the binary.

Mount every original file, preserving the gfx/ and sounds/ subdirectories.
No generated settings or substituted assets were added. Runtime data completeness
and optional game modes remain unproved until the original program is observed.

## Passive launch recipe, pending explicit runtime grant

Use the coordinator's current integration checkout, not the shared storage
checkout's detached HEAD. Refresh and independently verify runtime source/module
pins at grant time. The JSON plan provides forty exact original mounts and
12 DLL seeds (eleven bundled plus the authentic shared CRT).

Invoke `test/run.js` with the original EXE, `--exe-guest-path=C:\LTRIS\ltris.exe`,
`--cwd=C:\LTRIS`, `--args=-w`, one `--vfs-mount=HOST=GUEST` for each plan mount,
and one `--dll-seed=PATH` for each seed. Use existing canonical wasm with
`--no-build`, `--quiet-api`, `--no-close`, `--no-threads`, `--real-ticks`,
`--batch-size=200000`, `--max-batches=10000000`, `--max-seconds=60`,
`--control-stdin`, and a fresh output directory for captures.

Coordinator controller requirements: 65-second soft / 85-second hard process-group
guard; 8 MiB log cap; admission above 2 GiB +128 MiB and stop at 2 GiB +64 MiB;
no input. Capture periodic/final images. Record actual child/controller exits,
independent process absence and group emptiness, and unchanged source/module/
original pins. Review captures before publishing result.json; a menu is not
player-controlled gameplay.

Acquisition retained approximately 10.8 MB, below the authorized 50 MB cap;
free disk after preparation was 2,381,996,032 bytes. No full worktree was created;
the documentation branch uses a one-file sparse checkout.
