# Circus Linux! 1.0.0 — original Windows source screen

2026-10-18: original Windows archive acquired and statically checked. One granted
passive startup fails fast at CRTDLL `_fpreset`; no menu or gameplay reached.
No build, browser, registration, audio, or performance claim.

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

## Original passive startup — concrete CRT boundary

Run `20261018-circuslinux-passive-startup` used the prepared original route with
150 mounts, three original SDL DLL seeds, no arguments and no injected input.
Runtime checkout was `/tmp/wa-recovery-20261014` at
`78541f61ed0e051c7747a15de695a48f8fefa07b`; the existing module SHA-256 was
`fd1613e22ee7e77300d3f246b91295fb7da513dc5d37b64e6ca022eb89bdfc92`.
Physical source pins record the actual checkout independently of its HEAD.
Pure checks covered four disk boundaries, all mounts/seeds, no physical CRT
substitution, no arguments/input, syntax, and missing-grant refusal before launch.

At 20:31:43Z all three SDL DLL initializers returned EAX=1. The EXE then hit
`UNIMPLEMENTED API: _fpreset` at original VA `0x00463f60`, the import jump through
`[0x004b733c]`, with return address `0x0040115b`. This is a concrete early CRT
startup boundary, before the main program can display a window. No screenshot
was produced before failure; `output.log` preserves the complete 4,414-byte
failure report and stack. No other missing symbol is runtime-proven by this run.

Child 2441806 and controller 2441789 exited with status 1; terminal evidence is
20:31:43.285Z. The crash-text guard requested capture/quit, but the fail-fast
termination was already underway. No time, disk, or log-cap guard fired.
Minimum observed free disk was 2,335,801,344 bytes. Postflight and an independent
check verified all 3,144 source pins, all 150 original file hashes, archive and
module unchanged, both processes absent, and no remaining process-group members.
`review.json` was written after evidence inspection. As the title is unregistered,
there is no dashboard `result.json`, per the capture workflow.

Runtime is released. Any next implementation must provide actual `_fpreset`
semantics with appropriate focused tests; a successful reset alone would not
establish the later CRT data-import and I/O behaviors. No implementation, stub,
physical CRT replacement, rebuilt guest, or retry was attempted.

## Granted original retry after `_fpreset`

Run `20261018-circuslinux-fpreset-retry` used the same 150 original mounts, three
DLL seeds, no arguments, and no injected input after the independently reviewed
reset fix was integrated. Checkout `f5124ebc61d01ed4466aa5db0a4eab6ecbeedab6`
loaded module SHA-256
`0c617764e036d0422ab19bc0d97477ff68ba5eb8fa7c247833b7519e8060e5f7`.
Fresh admission free space was 2,289,852,416 bytes, above the unchanged strict
2 GiB plus 128 MiB threshold (2,281,701,376 bytes).

All three DLL initializers returned 1, and the original advanced beyond
`_fpreset` to **`UNIMPLEMENTED API: setbuf`**. Original VA `0x00464108`, return
`0x0043b903`; stack arguments are stream `0x07500050`, buffer NULL. The stream
value lies in the thunk address range and needs investigation before any future
I/O implementation can be called correct; this observation alone does not prove
which data-import semantics are wrong. No API was bypassed or replaced.

Child 2461881/controller 2461853 both exited 1; terminal timestamp
20:47:54.593Z. No window or PNG preceded failure; the complete log is 5,230 bytes.
Minimum sampled free space was 2,288,807,936 bytes. Independent postflight checks
verified 3,145 physical source pins, 150 originals, archive and module unchanged,
both processes absent and owned process group empty. Failure review was written
last as `review.json`; the title remains unregistered, so no dashboard result
was attached. No further fix, retry, build, browser, or gameplay claim. Runtime
released to the coordinator.

## Source-only stdio scope audit

`20261018-circuslinux-stdio-source/` retains aligned original WinMain disassembly
and the import record. `_iob` is a CRTDLL data import at IAT VA `0x004b7340`.
SDL's startup loads it and uses +32 for stdout, +64 for stderr. Before setbuf,
it calls freopen on each; if reopening fails, it calls fopen then copies eight
dwords into the original FILE address. The observed setbuf argument 07500050
and original +64 address computation imply `_iob` base 07500010, in the thunk
range. Existing `$handle__iob` implements a callable accessor instead; a true
data export must resolve to the actual registered 32-byte FILE array. The
fallback copy path is established statically, not separately traced live.

The current setvbuf handler validates stream/mode/size but leaves every stream
unbuffered and never retains the requested buffer. The write/read helpers issue
VFS operations immediately; custom buffering is not an available shared helper.
Microsoft's [setbuf contract](https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/setbuf)
requires NULL to disable buffering and a non-NULL BUFSIZ array to become the
stream's buffer; the void API has no error result. Its
[setvbuf contract](https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/setvbuf)
also requires actual use of supplied buffers. Simply calling the present
setvbuf handler from setbuf would therefore not implement that contract.

Scope checkpoint sent to the coordinator before code expansion: fix CRTDLL
data-export identity first, then explicitly scope real buffering state and its
read/write/flush/seek/close interactions. Invalid/foreign streams must not be
written through. Meaningful tests need actual immediate visibility for NULL,
deferred/custom-buffer visibility and flush behavior, ownership, invalid stream
rejection, and data-import identity; a successful no-op is insufficient. No
setbuf implementation, API row, test execution, build, or retry was made during
this audit.

## Prepared retry after bounded NULL setbuf support

The separately reviewed/tested setbuf branch ends at c3e30a7b4. It supports
NULL mode on canonical owned FILEs and explicitly traps custom buffers,
copied/inconsistent FILE state, and closed/unowned streams. Its compiled
validation does not establish Circus startup success.

A fresh source-only packet is retained at
`scratch/runs/20261018-circuslinux-setbuf-retry-prep/`. The next original passive
run uses the same 150 original mounts and three DLL seeds, no guest arguments
or input, 60-second guest limit, 65-second host quit and 85-second hard kill.
It now specifies both real calendar and real ticks without a wall-clock pin.
Admission remains strictly above 2 GiB plus 128 MiB, with the 64-MiB stop margin
and 8-MiB log cap. Copied-FILE rejection must be retained as an observed failure
if encountered, not bypassed.

Controller syntax and pure disk-boundary/argument checks passed, including
150 original-file hashes, unchanged mount/seed counts and refusal of unready
source/module pins. Pins are deliberately marked unready until the coordinator
releases its canonical build. No new runtime was performed for this packet.

## Original retry result after setbuf

The subsequent single granted run used root d239556956b2f5f554ebb2725604119ef34967e3
and module 67aaa6df401d2039bd70dd4f71bd683b69524918dda5c7e93d735f19688e147f.
Fresh preflight pinned 3,197 physical source/dependency files, including shared
MSVCRT (887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1),
all 150 originals and the archive. Admission free space was 2,432,458,752 bytes.

The original passed the previous setbuf boundary without copied-FILE rejection.
All three bundled DLL initializers returned 1. It opened waveOut at 11025 Hz,
two channels/16 bits, started a guest thread, and created a hidden zero-size
window titled circuslinux. This is startup evidence, not visible rendering or
audio correctness. It then failed at **CRTDLL `_setjmp`**, EIP 00464038, return
00409ddc, argument 009dcfec, with PNG signature bytes visible on the stack.
There was no menu, screenshot, gameplay, or input.

Evidence is retained at `scratch/runs/20261018-circuslinux-setbuf-retry/` with
review.json (still unregistered). Child 2500673 and controller 2500663 exited;
exit status was 1 at 2026-10-18T21:19:42.972Z, log 5,930 bytes, minimum free
space 2,431,373,312 bytes. Independent postflight confirmed all source/sharedCRT,
original/archive/module pins unchanged and both processes/groups absent. No
further retry, stub, replacement, or fix was attempted; runtime was released.
