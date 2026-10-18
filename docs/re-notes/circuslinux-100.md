# Circus Linux! 1.0.0 — original Windows source screen

2026-10-18: original Windows archive acquired and statically checked. No runtime,
build, browser, registration, gameplay, audio, or performance claim.

## Provenance and recovery

Official page <https://newbreedsoftware.com/circus-linux/download/> identifies
the Windows release as 1.0.0 from New Breed Software and links directly to
<https://tuxpaint.org/ftp/unix/x/circus-linux/win32/circuslinux-1.0.0.zip>.
HEAD and download returned 2,107,742 bytes; Last-Modified was 2003-08-18.
Archive SHA-256:
`29983cc728c563ca0c314f6bf3332c715ec9b7a9893b58504f4052fa70ced619`.
The original EXE timestamp is May 29, 2000; mirror modification time is not the
executable build time. Bundled COPYING.txt is GNU GPL version 2; no installer or
license answer was needed. Original source and build files accompany the binary.

Retained evidence is `scratch/runs/20261018-circuslinux-source/` in the shared
repository, outside Git. Its `acquire.js` is a bounded recovery recipe; download
the exact URL, verify archive hash, inspect the ZIP directory and expansion size,
then extract preserving the `circuslinux-1.0.0/` subtree. Acquisition and evidence
have a 24 MiB total cap and refuse work below 2 GiB plus 64 MiB free. Archive
expansion is 4,303,588 bytes across 150 files. The retained directory was about
7.1 MB after inspection, comfortably below the cap.

`source-manifest.json` hashes every original; `archive-listing.json` retains ZIP
metadata. `verify-plan.js` re-compares every extracted file byte-for-byte with
the original ZIP and regenerates `verification.json` and `passive-plan.json`.
All 150 comparisons passed; independent `unzip -t` reported no compressed-data
errors. No original was patched. No prior Circus Linux registry, corpus, task,
notes, board entry, or local payload was found during selection.

## PE and asset closure

`circuslinux.exe` is original i386 PE32, preferred base `0x00400000`, entry RVA
`0x11a0`, SHA-256
`a6a41ef40de82b03f62ab6f960744be13b5125392bfc2c00e8cf3dd760a3e0a2`.
It imports CRTDLL, GDI32, KERNEL32, USER32 and WINMM. It does not directly import
the supplied SDL DLLs; do not assume this release shares the newer LGames SDL
runtime route. Bundled `SDL.dll`, `SDL_image.dll`, and `SDL_mixer.dll` are all
i386 PE32. SDL_image and SDL_mixer import SDL and KERNEL32; SDL imports WINMM,
KERNEL32, USER32 and GDI32. Independent objdump import lists agree with the JS
PE reader for all four binaries; full symbols are retained in `pe-closure.json`
and the four `*.pe.txt` reports.

There are no unresolved vendor DLL names in the static recursive closure.
CRTDLL is recognized by `lib/dll-loader.js` as a Windows system DLL; **this does
not establish that its required semantics work**. No physical CRT is substituted.
`api-name-screen.json` records names absent from the exact API table: `_fmode_dll`,
`_environ_dll`, `_fpreset`, `_setjmp`, `longjmp`, `setbuf`, `_fileno`, and
`waveOutGetErrorTextA`. Aliases and data imports may resolve elsewhere; this is a
startup risk, not a proven runtime failure or permission to install silent stubs.

The included Makefile-win32 uses `DATA_PREFIX="data/"`. All 123 literal asset
references in original `circuslinux.c` exist in the archive. Preserve all 150
files with their relative directories, including images, sounds, music, source,
README and COPYING. Runtime discovery of additional files remains untested.

## Prepared passive route

`passive-plan.json` gives 150 hash-pinned host/guest mounts under `C:\CIRCUS`,
EXE `C:\CIRCUS\circuslinux.exe`, cwd `C:\CIRCUS`, no arguments, and three
original DLL seeds. The source defaults `use_fullscreen=0` and selects a 640x480
window; README reserves `--fullscreen` for opt-in. No speculative resolution
switch or changed binary is needed. README says `circuslinux.dat` stores scores
and volume in the Windows application directory.

Next runtime, only after coordinator grant and fresh source/module/disk pins:
one passive 60-second startup, 65-second soft/85-second hard wall bounds,
8 MiB log cap, strict 2 GiB floor with 128 MiB admission/64 MiB stop margins.
No injected input. Review captures and report the first concrete CRT/API or
rendering boundary. A menu alone does not qualify core gameplay. Do not silently
replace CRTDLL with MSVCRT or rebuild the supplied source to evade an original
binary blocker.
