# Mad Bomber 0.2.5 — original Windows package

Source-only candidate preparation, 2026-10-18. No build, guest execution,
browser, registration, gameplay, performance or publication claim.

## Selection and provenance

Mad Bomber is a distinct game absent from the current `DESKTOP_APPS`, local
candidate list, candidate corpus, TODOS and reverse-engineering notes searched
on 2026-10-18. It fills the lane vacated by qualified Barrage; the coordinator
owns the rolling-pipeline ledger and runtime grants. Circus Linux owns the
build/native resource during this preparation.

The [publisher download page](https://www.newbreedsoftware.com/madbomber/download/)
identifies its Windows binary as version 0.2.5, supplied by Torsten Giebl, and
links directly to this original ZIP:

`https://tuxpaint.org/ftp/unix/x/madbomber/win32/madbomber-0.2.5-1.zip`

Archive: **2,957,899 bytes**, SHA-256
`f21ab59154fd434f0952daf84848af47bf50262b7317f2ca1dbf7f43cb213164`.
The HTTP Last-Modified header was 2003-12-31 21:36:47 GMT. This is the
publisher-linked precompiled Windows package, not a rebuilt source tree or
modern substitute. No installer or licence prompt was executed or answered.

## Original closure and evidence

Retained under `scratch/runs/20261018-madbomber-source/` in the coordinator
checkout: archive, `upstream.html`, `original/madbomber-0.2.5/`, `files.json`,
`closure.json`, eight `*.objdump.txt` reports, `verify.cjs`, and
`verification.json`. These ignored artifacts are not preserved by Git.

The ZIP has 154 entries: 140 files and 14 directories. All 140 original files
total **3,606,032 bytes**, including 126 data files. `unzip -t` passes; the
JavaScript verifier independently compares each extracted file against its
ZIP member and inventory size/hash. All 140 comparisons pass. Inventory
SHA-256: `555911f0a2a63285d3d0d386f6be2e658375e27172e22dd5f87ddab42ce9c013`.
Free space after preparation was 2,420,887,552 bytes; acquisition was admitted
only above 2 GiB + 128 MiB with a further 32 MiB reserve.

Original PE32 i386 modules:

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| madbomber.exe | 19456 | `72ad26d11ddabf72c668b69eda0c7c1daa634f5cade631303ba4e05eb5f5cc09` |
| SDL.dll | 86016 | `55eced17cf8a9b7acc671cc307503de847a3c36fdafafe14cee7917433cfe410` |
| SDL_image.dll | 13824 | `50c505ec8e9586c7445d8b6da5c074ce5c2deec6099e94b259341b63d3389156` |
| SDL_mixer.dll | 122368 | `e48583f82cd4a503e6ed9097da51399b05e4c5b92e66566e3b180321c6647165` |
| jpeg.dll | 89571 | `37e38cee4955ee9a38e28b6f8bbde7c21b920dc14a518d39ca87004cc5f91131` |
| libpng1.dll | 47616 | `646ff9f1e5a050eb329c4554349c3a5b35eb86812b2f572211113d35db1314db` |
| zlib.dll | 27648 | `215d542025251e70a00ddc1cfa19fe00a7e5e24b67699e129fb8be0ff2972109` |
| msvcr70.dll | 164864 | `80ec1779b8026293d65598aa3b73e7491cde4a89450d09b333408a8fcd206b38` |

Static wrapper import closure:

- EXE: KERNEL32, msvcrt, SDL, SDL_image, SDL_mixer.
- SDL: KERNEL32, GDI32, MSVCR70, USER32, WINMM.
- SDL_image: KERNEL32, jpeg, libpng1, MSVCR70, SDL.
- SDL_mixer: KERNEL32, MSVCR70, SDL, WINMM.
- jpeg: KERNEL32, msvcrt. libpng1: KERNEL32, MSVCRT, zlib.
- zlib: KERNEL32, CRTDLL. MSVCR70: KERNEL32.

Every non-system module named by these wrappers is bundled. Preserve the
original MSVCR70 and all other DLL bytes. KERNEL32/GDI32/USER32/WINMM/MSVCRT/
CRTDLL names are emulator system dependencies, not missing redistributables.
The EXE is UPX-packed (entry RVA `0x16600`, base `0x400000`, GUI subsystem 4.0)
and its wrapper imports MSVCRT `_iob`. Several DLLs also expose packing-loader
imports. **This is not a complete runtime API closure:** dynamically resolved
imports remain unknown until the original packers run. Do not replace or
externally unpack the gameplay executable. Circus's CRTDLL `_iob` work does
not prove MSVCRT or dynamic GetProcAddress data-import compatibility here.

## Recovery recipe

In a fresh private directory, first require available disk space above
2 GiB + 128 MiB plus a 32 MiB acquisition reserve. Download the exact URL with
`curl -fsSL --max-time 45 --max-filesize 4194304 -o madbomber-0.2.5-1.zip URL`.
Verify the full archive SHA-256 above before extraction. Inspect `unzip -Z1`
for absolute/traversal paths, run `unzip -t`, then extract with
`unzip -q madbomber-0.2.5-1.zip -d original`. Keep the entire original
`madbomber-0.2.5` tree; no conversion or reconstructed configuration is needed.
Verify file count, byte total and all eight module hashes above. With the
retained run bundle, `node verify.cjs` also checks every original ZIP member.

## Next bounded validation, requiring a fresh runtime grant

Prepare one passive original launch with `madbomber.exe` as the entrypoint,
its own directory as guest working directory, all 140 files mounted at their
relative paths, and all seven bundled DLLs available to the real DLL loader.
`closure.json` records each guest-relative mount and original hash. The
upstream README explicitly says to launch beside the `data` directory.
Use no arguments or inputs for this first run; sound stays at its original
default. Plan 60 seconds guest wall guard, 65 seconds supervisor termination,
85 seconds absolute cleanup deadline; 8 MiB log cap, admission above
2 GiB + 128 MiB and stop below 2 GiB + 64 MiB. Refresh original/source/module
pins and disk admission immediately before the coordinator grants execution.
Use real calendar and real ticks without a fixed calendar pin. Capture the
initial loading/title screen, inspect it, record any first fail-fast API and
independently confirm the owned process group exits. No automatic retry.

Only after a reviewed title screen should a separate control plan select
ONE PLAYER using the documented menu arrows plus Enter/Space or a reviewed
mouse target. The original README documents Left/Right or mouse motion to
move the buckets, and Space/Enter/click to start bombs. A later bounded
gameplay qualification needs visible buckets responding to an ordinary
balanced input pair, bombs in play and a reviewed gameplay capture. Menu,
successful unpacking, or a screenshot alone is insufficient. Stop for any
unanswered licence prompt; no source patch, guest patch or substituted DLL
is authorized by this preparation.

## Guarded passive packet (2026-10-18)

`scratch/runs/20261018-madbomber-passive-prep/` holds `controller.js`,
`passive-plan.json`, `launch-manifest.json`, `current-pins.json`,
`pure-checks.cjs` and `pure-results.json`. It adapts the already-used Circus
passive controller, with this game's original directory and exact mounts.
All 140 mounts and seven real DLL seeds are checked against the original
inventory before launch; modified working directory, entrypoint, omitted
mounts or omitted seeds are rejected. MSVCR70 stays an original seeded DLL.
No conclusion about MSVCRT `_iob` follows from the separate CRTDLL change.

The packet targets the canonical CLI checkout `/tmp/wa-recovery-20261014`.
It refuses execution without the coordinator's exact per-run environment
grant and ready, nonempty source/module pins. Pins are intentionally marked
`awaiting-canonical-release`: no pre-rebuild module or source identity is
presented as current. Refresh them only after the coordinator releases its
canonical rebuild; rerun the original verifier and full packet preflight
before any separately granted execution.

The route uses no arguments or player input, real ticks/calendar without a
fixed wall-clock pin, explicit original mounts/seeds, `--no-build`, and the
60/65/85-second limits above. The child runs in an owned process group;
natural exit, controller signals and hard stops clean up that group, with
postflight source/original hashes and process inventory. Disk is polled every
250 ms; the 8 MiB log cap hard-stops, and licence/crash text requests a normal
quit. Scheduled 5/15/30/45/58-second captures are observations only. Separate
independent postflight remains required after the eventual real execution.

JavaScript syntax and pure checks pass: four disk-boundary cases, exact
140-mount/seven-seed closure, four altered-plan refusals, clock/limit flags,
missing-grant refusal before output creation, and unready-pin refusal.
These checks did not create a guest, build or browser. The actual timeout,
crash and process cleanup behavior remains to be observed in the granted run.

## First passive execution: zlib initialization fails (2026-10-18)

The coordinator subsequently released canonical commit
`01845dfa3b566788f00fc2ce5727ab3f50c5ce32`, module SHA-256
`1505f311d2d6edc98c184bfcf9093485036db0ec55a590e00b655c6fffbf3afa`,
and granted exactly one passive run. Refreshed 3,146 physical source pins,
all 140 original hashes, archive identity, and disk admission passed.
Evidence: `scratch/runs/20261018-madbomber-passive-startup/`; `review.json`
is used because this candidate is not registered in the corpus.

The original zlib loaded at `0xc5d000`, original base `0x10000000`, entry
`0xc6fb80` (original VA `0x10012b80`). The log reports its DllMain returning
zero twice during initialization/failure cleanup, followed by
`DLL_PROCESS_ATTACH returned FALSE` from `lib/dll-loader.js`. jpeg and the
auto-loaded MSVCRT initializers returned one. This is a loader initialization
failure, not an identified unimplemented API. There was no window, capture,
title, ordinary input, or gameplay. Do not infer the cause of zlib's zero
return or diagnose it as the Circus CRTDLL `_iob` problem from this log.

The ordinary CLI graph additionally auto-loaded a real shared `MSVCRT.dll`
through its `test/binaries/dlls` fallback (see `test/run.js` DLL search order),
beyond the seven bundled DLL seeds. That shared file was **not pre-run
hashed**. `shared-crt-postrun.json` records its post-run path/hash and explicitly
does not claim a pre-run byte identity. Any further run must include that
shared dependency in fresh pins; the source-only wrapper closure above did
not establish that runtime dependency identity. No game DLL was replaced.

Child 2487570 and controller 2487559 exited with failure; terminal time was
2026-10-18T21:09:10.978Z, log 2,433 bytes, minimum sampled free space
2,461,089,792 bytes, no disk/log/time guard triggered. Independent postflight
confirmed both PIDs absent, the owned group empty, and all 3,146 source pins,
140 original files, archive and module unchanged. The runtime slot was
released, with no retry. Next useful work is a source-only audit of the
original zlib packed initializer and the failed attach path, followed by a
separately reviewed plan if a runtime diagnostic is warranted.

## Original zlib entry audit: explicit import-failure branch

Source-only audit evidence is in
`scratch/runs/20261018-madbomber-zlib-audit/`: original-entry disassembly,
four direct byte assertions in `static-checks.json`, a future shared-CRT pin,
and `next-plan.json`. The original DLL hash still matches the package.
No unpacked replacement, modified guest, source rebuild, or new execution
was used to obtain these findings.

The on-disk UPX entry at original VA `0x10012b80` checks the reason argument
against 1. For process attach it saves registers, expands its own packed
payload, fixes calls, resolves imports, applies relocations, then jumps to
original VA `0x1000a7b0` (RVA `0xa7b0`). Other reasons jump directly there.
The original body at that destination is in packed payload space and has
not been statically recovered or qualified.

The first explicit FALSE-return block in this visible original entry is:

```text
10012caa  call [esi+123a4]       ; wrapper IAT LoadLibraryA
10012cb0  xchg eax,ebp          ; retain the returned module handle
...                            ; import-name iteration
10012cbf  call [esi+123a8]       ; wrapper IAT GetProcAddress
10012cc5  or eax,eax
10012cc7  je 10012cd0
10012cc9  mov [ebx],eax         ; successful import
...
10012cd0  popad
10012cd1  xor eax,eax
10012cd3  ret 12                ; FALSE from DllMain
```

At this phase ESI is the destination base+`0x1000`, so the two slots are
RVA `0x133a4` and `0x133a8`, matching the original KERNEL32 import table.
The package also statically names CRTDLL `free`. The wrapper does not check
LoadLibraryA's result before using it for GetProcAddress; a failed module
load or an unresolved symbol can therefore reach this same FALSE branch.
The complete unpacked import-name list is not established from these bytes.
Do not name an absent CRT export or claim the branch was taken from the old
return-only log. GetProcAddress can normally return NULL without triggering
an unimplemented-API trap; that is compatible with the observed quiet failure.

With the prior observed zlib base `0xc5d000`, the GetProcAddress caller return
address is `0xc6fcc5`, the explicit FALSE block is `0xc6fcd0`, and the normal
post-unpack entry is `0xc677b0`. Future diagnostics must recompute these from
the actually logged load base rather than assume this allocation repeats.

The smallest proposed discriminator is one original no-input startup with
the same mounts/seeds and only these existing tracing flags added:

```text
--trace-api=LoadLibraryA,GetProcAddress
--trace-api-mem=LoadLibraryA:0:128,GetProcAddress:1:128
```

The CLI source records caller return addresses for filtered API entries,
typed EAX returns at API exit, and flushes buffered diagnostics through its
failure-cleanup callback even if DLL attach aborts before the main loop.
This avoids a new instrumentation hook or a breakpoint that could stop an
earlier unrelated initializer. A GetProcAddress call returning zero with
caller return RVA `0x12cc5` identifies this zlib failure path; the preceding
LoadLibraryA and name bytes distinguish a bad module handle from a missing
export. If those lookups succeed, the original-body failure remains open.

Proposed limits are 10 seconds guest, normal quit at 15, hard kill at 25,
2 MiB log cap, the existing strict disk guards, and no retry. A new grant is
required. `shared-crt-pin.json` records the current 278,581-byte shared
MSVCRT SHA-256 `887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`
for future preflight; refresh and verify it alongside all 140 original files,
the archive, physical source files and the canonical module immediately
before any new launch. This does not repair the prior run's missing CRT pin.

### Prepared import diagnostic controller

`scratch/runs/20261018-madbomber-import-prep/` now contains the guarded
controller, exact 140-file mount/seven-DLL seed plan, original inventory,
pending canonical pins, mandatory `shared-crt-pin.json`, pure checks/results
and packet hashes. It implements the proposed 10/15/25-second limits and
2 MiB log cap, preserving the original no-input route and two filtered API
traces. The shared CRT path, size and expected hash are checked before any
guest spawn and again at postflight; a changed CRT requires review rather
than silently accepting another binary. Both shared-CRT and canonical pin
records intentionally remain pending until release and fresh preflight.

Syntax and pure checks pass: four disk boundaries, all mounts/seeds, four
route-tamper cases, three CRT identity-tamper cases, pending-CRT refusal,
current shared bytes matching the expected hash, missing-grant refusal,
exact trace/clock/guest-limit flags, and supervisor/log-limit constants.
No guest execution occurred. The previous passive grant does not authorize
this controller: its distinct grant token is
`20261018-madbomber-import-diagnostic`. Circus has runtime priority; a new
explicit coordinator grant is required after its release.

## Granted import diagnostic: CRTDLL `_fdopen` is unresolved

One coordinator-granted diagnostic ran on commit
`cfdb896d15795f6ba9c7b54ce7336e3769047846`, canonical module SHA-256
`67aaa6df401d2039bd70dd4f71bd683b69524918dda5c7e93d735f19688e147f`.
Fresh preflight included all 3,146 physical source records, 140 original
package files, ZIP identity, and the shared MSVCRT hash above. Evidence is
`scratch/runs/20261018-madbomber-import-diagnostic/`; reviewed metadata is
`review.json`, with parsed/asserted calls in `import-findings.json`.

The trace now supports the explicit packed-import failure path:

| Call | Observed result |
| --- | --- |
| zlib LoadLibraryA("KERNEL32.DLL") | `0x00db7e54` |
| zlib GetProcAddress GlobalAlloc/GetVersion/GlobalFree | each nonzero |
| zlib LoadLibraryA("CRTDLL.dll") | `0x00400000` |
| zlib GetProcAddress "fflush" | `0x07504870` |
| zlib GetProcAddress "fprintf" | `0x07504878` |
| zlib GetProcAddress "_fdopen" (API 110) | **NULL** |

The failing name pointer was `0x00c6e048`; the 128-byte diagnostic contains
the exact NUL-terminated `_fdopen` name. Caller return `0x00c6fcc5` minus
actual zlib load base `0x00c5d000` equals RVA `0x12cc5`, the original test
and conditional branch documented above. The zero result therefore supports
the original wrapper's explicit FALSE return, rather than an unidentified
failure inside the original post-unpack entry. No guest instructions were
modified. The loader then reports `DLL_PROCESS_ATTACH returned FALSE`.

This identifies the first unresolved zlib import, not the completeness of
its remaining API closure. The buffer also contains later names, but they
were not looked up successfully in this execution. Earlier jpeg requests to
the real shared MSVCRT, including `_iob`, returned nonzero; this is not a
general CRT-data or gameplay qualification. In particular, CRTDLL's observed
`0x00400000` handle is the runtime's existing route, not evidence that a real
CRTDLL image was loaded.

Child 2505219/controller 2505209 finished with failure at
2026-10-18T21:23:47.810Z; log 18,082 bytes, minimum sampled free space
2,429,329,408 bytes. No window/PNG or player input, no guard fired, no retry.
Independent postflight found both PIDs absent and the process group empty;
all source, original, archive, shared CRT and module pins remained unchanged.
Runtime was released. Next action is a bounded source review of actual
`_fdopen` FILE/descriptor ownership semantics and resolver availability,
with conformance coverage before any implementation or new original retry.
