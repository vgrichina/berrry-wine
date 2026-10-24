# Enigma unpacked diagnostic: explicit provider set stops at SDL_getenv

One diagnostic attempt on 2026-10-24 reached **`sdl.dll!SDL_getenv`** and trapped
at batch 18, before any observed Lua shared-loader request. The runner exited 1
after 0.2233 seconds. This is the first observed failure of the **configured
runner**, not original packed startup acceptance, gameplay acceptance, or proof
that SDL_getenv needs a new implementation.

The exact command explicitly set `--dlls=.../system/msvcrt.dll` only. Canonical
runner lines 5588–5602 choose that explicit list instead of the automatic import
graph. Although all SDL diagnostic files were present in the mounted tree,
`SDL.dll` was not preloaded as a native provider. The log confirms only MSVCRT
was loaded. This configuration limitation caused an imported SDL function to
reach the built-in unimplemented path. No second attempt, provider change,
dependency download, native build, or semantic patch was made.

## Terminal and native binding

The retained terminal reports `UNIMPLEMENTED API: SDL_getenv`, EIP `0x5de8e0`,
ESP `0x074ffdfc`, and caller return `0x5de2a6`. Native thunk bytes
`ff 25 bc f7 9e 00` resolve through IAT `0x9ef7bc`; the unchanged sealed parser
maps it to `sdl.dll!SDL_getenv`. Its argument points to `0x95b70a`, whose sealed
native bytes spell `SDL_STDIO_REDIRECT`. The unpacked SDL image exports that
symbol at RVA 37536. This static string is identified separately from a live
guest string read. `static-failure.json` records the exact byte-backed binding.

Two supported API trace requests were emitted: MSVCRT requested
`GetProcAddress(...,"IsProcessorFeaturePresent")`, returning `0x00b53634`, and
Enigma requested `LoadLibraryA("DDRAW.DLL")`, returning nonzero handle
`0x00b67c6c` at return `0x5de288`. A nonzero handle does not prove a native
DDRAW module was loaded. Neither event is the Lua package-loader entry.

The retained runner uses one `set_bp` address and JS block boundaries for
multiple trace addresses; its generic string reader lacks a proven valid guest
mapping check. The authorized narrower API-trace fallback was selected before
launch. No exact entry/register/NUL-string/cache record for `0x5ab8f0` or
`0x5ab957` exists. Requested block counters were armed, but the crash path did
not print their totals; counts remain unknown. No concrete Lua DLL, symbol,
caller or cache branch is established. No frame was emitted before the crash.
Optional codecs and conditional `loadall.dll` remain necessity-unknown.

## Immutable inputs and exact mount

Donor HEAD `763c9f6bca47fd555b675aaa400e477307318af0` was verified with the
provided dedicated identity and trusted-known-hosts SSH configuration. The
canonical runner SHA256 is
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`.
Historical module SHA256 is
`8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`,
source `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`, ABI 291,
layout `9a3bc9149d58209c`; it was copied from the standing manifest and rehashed,
without compilation or substitution. EXE SHA256 is
`5885e29ac9c1bdfe7f36e0d7fba76a56b74bc99558e1e6debf8425febe35fa45`.
All twenty packed-input/unpacked-output pins were rehashed; ten diagnostic
outputs total 7,828,992 bytes. Original assets stayed unchanged.

Original manifest SHA256 is
`74a65c35b0742c00f0a53f4590fe1c888715e6b59acae8f0349d1d98c1dbb574`;
all 2,460 originals were rehashed (17,591,277 logical / 22,994,944 allocated
file bytes). Only remote owned files received the ten diagnostic replacements.
The complete overlaid asset tree was enumerated and hashed with the actual
canonical parser and VFS helper. Comma-bearing names, if any, are enumerated in
`original-overlay.json` and the full mapping; no comma-delimited per-file mount
was used. `mount-manifest.json.gz` records every source and target hash;
`mount-validation.json.gz` records all 2,460 exact guest mappings.

The complete runner/system/asset manifest contains 2,659 files and 37,476,538
logical bytes. It was streamed from standing files/Git blobs using the retained
bounded transfer recipe, without a local duplicate asset tree. The transfer
recipe initially omitted one zero-byte file, `data/enigma_conf.lua`; its hash
guard failed and stopped. Only that empty owned remote file was materialized,
then complete verification passed after the state change. The failure and
correction receipts are preserved. No asset was excluded from the final tree.

## Gates, resource limits and evidence qualification

Preflight passed as ordinary UID 1000 with Node v24.22.1, pinned pngjs 7.0.0,
actual runner dependency-preamble resolution, 28 font files, pixel-preserving
PNG encode/decode and two rejecting PNG controls. The trace-only preload seals
the canonical runner and bounds API requests to 16; its changed-source rejection
and 40-request/16-record limit fixture passed. It changes diagnostic recording
only. Supervisor descendant TERM/KILL/reap and output-guard controls passed.

Guest configuration was fixed 512 MiB shared linear memory, Node heap512 MiB,
CPU90 / wall60 seconds, runner55 seconds, output guard131072 bytes. Actual
prelaunch remote MemAvailable was 7,186,358,272 bytes; materialized task directory
was 45,547,520 allocated bytes, largest file 6,287,872 bytes. Launch projection
was 65,781,760 / 67,108,864 including both hosts, source/Git/evidence, transfer
overlap, full session/events, positive SQLite growth, future allowance and8MiB
reserve. Both hosts remained above the required 2,982,150,144 free-byte floor.

An earlier accounting recheck failed at 67,321,856 after increasing remote
evidence allowance. Transfer was paused immediately. The remaining future
allowance was adjusted while retaining all measured history/SQLite bytes and
the8MiB reserve; the changed projection passed before transfer resumed. Later
remaining-future bookkeeping reductions are explicitly recorded, not deleted
history or a larger allocation.

**Capture qualification failed after execution:** collecting the full mapping
produced at least1,093,346 API response bytes, above the1,048,576-byte cumulative
capture cap. The initial decoded-payload estimate780,643 omitted transport
metadata/base64 overhead. No further remote collection or attempt followed
detection. All failed output remains charged and retained. This run is useful
terminal evidence, but must not be represented as fully policy-compliant runtime
acceptance. `capture-final.json` supersedes the earlier understated estimate.

## Cleanup and recovery

Guest output is4,531 bytes. It exited naturally1 before the supervisor detected
the trap; TERM/KILL were unnecessary. The supervisor reaped its child and found
no remaining group; the subsequent owned-process scan found no task Node process.
Box `bx_ucns7qgy` remained RUNNING (API state `idle`, health `ok`), expiry
2026-10-24T09:40:12.681Z. Coordinator owns shutdown09:34; no worker lifecycle
mutation was issued. Handback was appended to the root messageboard at09:19:39Z.

All exact executed helpers, command, terminal, API trace, gates, static binding,
seals and compressed manifests are beside this note. Raw task evidence remains
under `/tmp/enigma-diagnostic-loader-startup-oct24/`; use gzip decompression to
recover manifests and their exact standing source paths. Retained setup/stage/
gate/launch scripts document the route, not authorization for another guest.
Root tracked files/index/refs, donors and original assets were read-only;
coordination writes were append-only. No workers were launched and no main merge
or public deployment was performed. The coordinator owns any next assignment.
