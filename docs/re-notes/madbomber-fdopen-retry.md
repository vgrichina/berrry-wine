# Mad Bomber: original fdopen retry

2026-10-18, one original passive diagnostic after the tested binary `_fdopen`
implementation and callback ownership prerequisite were integrated. This is a
follow-up to [Mad Bomber 0.2.5](madbomber-025.md) and the
[binary fdopen contract](crt-fdopen-binary.md).

## Observed result

The original zlib packed initializer passed its previous missing-symbol boundary:

| API event | Original call | Result |
| --- | --- | --- |
| 110 | `GetProcAddress(0x00400000, "_fdopen")`, return `0x00c6fcc5` | `0x07504880` |
| 111–121 | Further original CRT import lookups through `fseek` | Nonzero |
| 122 | `GetProcAddress(0x00400000, "rewind")`, return `0x00c6fcc5` | NULL |

The process then reported `DLL_PROCESS_ATTACH returned FALSE` and exited 1.
The caller is the same original zlib lookup loop (RVA `0x12cc5`) identified in
the earlier diagnostic. This proves the previous `_fdopen` resolution boundary
is cleared and identifies the next unresolved symbol. It does **not** prove
that the original game called `_fdopen`, used a supported mode, or reached its
menu. There was no `_fdopen` invocation, window, PNG, guest input or retry.

No unpacked replacement, import bypass, mode bypass or fake symbol was used.
`rewind` remains a new implementation/review task; this run did not change it.

## Exact run and preservation

Canonical source HEAD: `c8399aa73fd0e80feb561abe3f60c6f90ddaaa54`.
Module SHA-256:
`aafa600aabbf48b03ba1166ae7bf9c69dc77af499e8e4cb813e60c5bd3b924b1`.
The retained original route had 140 physical files mounted into `C:\MADBOMBER`
and seven original DLL seeds, with the original EXE and original package hashes.
The automatically available shared `msvcrt.dll` was separately pinned before
and after, SHA-256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`
(278,581 bytes).

The controller used the existing cooperative CLI with real calendar/ticks,
no guest input, no build and no threads. Guest time limit was 10 seconds,
controller quit at 15, hard group kill at 25, and log cap 2 MiB. Filtered API
trace covered LoadLibraryA, GetProcAddress and `_fdopen`, with bounded name/mode
memory capture. The retained launch JSON contains the exact full argv.

Start: `2026-10-18T22:39:08.031Z`; finish: `2026-10-18T22:39:08.189Z`.
Log: 25,927 bytes. Minimum free disk: 2,321,084,416 bytes. No disk/time/log guard
triggered. The child PID was 2590262 and controller PID 2590238; both were
independently absent afterward and the child process group had no survivors.
All 3,204 physical source pins, the module, 140 original files, original archive
and shared CRT matched after the run in both controller and independent checks.

Evidence is under repository-root
`scratch/runs/20261018-madbomber-fdopen-retry/`: original log, launch and identity,
all pin manifests, terminal receipt, controller, independent postflight and
structured import findings. `review.json` was written after inspecting them.
The app remains unregistered, so no unrelated dashboard candidate/result entry
was created. The prepared packet is separately retained under
`scratch/runs/20261018-madbomber-fdopen-retry-prep/`, including pure guard tests,
packet hashes, unchanged original launch plan/manifest, and the freshly pinned
canonical/shared-CRT identities. The pure checks cover disk boundaries, route
tampering, missing grant, unready/tampered CRT pins and bounded trace/time flags.
