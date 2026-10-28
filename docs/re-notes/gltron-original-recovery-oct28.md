# GLTron 0.70 original Win32 recovery — 2026-10-28

Recovered the original Windows distribution from the assigned official stable
[SourceForge release URL](https://sourceforge.net/projects/gltron/files/gltron-win32/0.70/gltron-0.70-win32.exe/download)
once, following its two ordinary HTTPS redirects. HTTP 200, 3,658,814 bytes;
SHA-256 **8956abae4e4fe6ebc45b97d58c9254789e0a1457d11c58e4dbb90aead45a3eb3**.
The supplied oracle was unchanged. Original project documentation URL:
https://gltron.sourceforge.net/download.php (currently redirects to the project
page). No alternate distribution, source rebuild, installer execution or Wine.

## Retained original and closure

Durable task root:
`/home/user/wine-assembly/scratch/usage-watch/gltron-original-win32-recovery-oct28/`.
The original is `payload/gltron-0.70-win32.exe`; recovered game root is
`payload/extracted/app/`. These ignored binaries are retained locally, not in Git.
`receipt.json` is the canonical commit/publication/resource/evidence manifest.

The installer is Inno Setup 2.0.18. Installed 7-Zip 23.01 rejected it (exit 2);
installed innoextract 1.9 successfully listed and extracted it without execution.
Its 92 regular payload files total **4,968,893 bytes**; conservative pre-write
expanded upper bound was **5,035,457 bytes**. All installer Adler32 checksums
matched. `payload/inventory.json` contains every extracted path, exact size,
SHA-256 and Adler32. Every declared member is present with no extra files or links.

The actual game executable is `app/gltron.exe`. All eleven PE modules are Intel
80386 (`0x014c`), PE32 (`0x010b`). Bundled DLLs, preserving original case:
`MSVCR70.dll`, `SDL.dll`, `libpng.dll`, `mikmod.dll`, `ogg.dll`, `sdl_sound.dll`,
`smpeg.dll`, `vorbis.dll`, `vorbisfile.dll`, and `zlib.dll`.

`payload/closure.json` records each module's imports and case-insensitive
resolution. `gltron.exe` imports SDL, libpng, zlib, sdl_sound and MSVCR70 from
the bundle, plus Windows OPENGL32 and KERNEL32. The recursive static DLL import
closure has **zero unresolved non-system imports**. Ordinary Windows imports
(including MSVCRT, WINMM, USER32, GDI32, DSOUND and ADVAPI32 where present) are
system dependencies, not missing game DLLs. Bounded installed `objdump -p`
outputs for all eleven modules are in `payload/static/`.

Required package data is preserved in full: `data/` models, materials, font
descriptors and WAVs; `art/classic`, `art/default`, `art/metalTron`; `scripts/`
Lua configuration/menu/audio/video logic; and `music/revenge_of_cats.it`.
Preserve this directory layout and all 92 inventoried files together.

`app/docs/README.html` preserves the original copyright and GPL v2-or-later
notice, disclaimer, soundtrack copyright and project reference. The full GPL
text is not a separate bundled file; this remains a distribution limitation.
No license text was replaced or inferred from a different game/version.

## Repeatable bounded recipe

Tracked recipe: `tools/recovery/gltron-original-win32-recovery-oct28.py`.
Run installed tools in place under a descendant-aware supervisor. The retained
task-specific wrapper is `ops/guard.py`, with `ops/child.py` and the pinned
`ops/supervisor.py` under the durable task root. It records preflight and peak
allocated task bytes, positive WAL growth, session/client log bytes, free disk,
MemAvailable, descendant RSS/CPU, exit status and cleanup. Limits are 128 MiB
aggregate physical RSS, Python DATA 128 MiB (Git alone 256 MiB), CPU 90 s,
wall 120 s, file 12 MiB, capture 2 MiB, and terminal output under 8192 bytes.
Task allocation is 64 MiB including an 8 MiB reserve and prospective growth;
host floor is 2,982,150,144 bytes after three 64 MiB reservations.

Commands below assume the isolated branch checkout at
`/tmp/gltron-original-win32-recovery-oct28/repo`. For an already retained payload,
run `verify` and reuse its receipts; **do not redownload or re-extract it**.
For a separately authorized fresh recovery, the chosen payload directory must
not exist and must be charged to the task allocation before these commands:

```sh
set -e
TASK=/home/user/wine-assembly/scratch/usage-watch/gltron-original-win32-recovery-oct28
REPO=/tmp/gltron-original-win32-recovery-oct28/repo
python3 "$TASK/ops/guard.py" focused python3 "$REPO/test/test-gltron-original-win32-recovery-oct28.py"
# Continue only on exit 0. Use a fresh, authorized payload directory for download.
python3 "$TASK/ops/guard.py" acquire python3 "$REPO/tools/recovery/gltron-original-win32-recovery-oct28.py" download "$TASK/payload"
python3 "$TASK/ops/guard.py" unpack python3 "$REPO/tools/recovery/gltron-original-win32-recovery-oct28.py" extract "$TASK/payload/gltron-0.70-win32.exe"
python3 "$TASK/ops/guard.py" closure python3 "$REPO/tools/recovery/gltron-original-win32-recovery-oct28.py" analyze "$TASK/payload/gltron-0.70-win32.exe"
```

These are separate guarded operations: stop at each nonzero status. The recipe
itself sequences metadata/hash gates before dependent operations. Download has
a 12 MiB cap, socket and elapsed deadline, bounded redirect chain and immutable
hash. An access denial or hash mismatch stops that route; there are no retries
or mirror choices. Inno metadata is bounded to 2 MiB/2048 members and the exact
known installer/version grammar. Absolute paths, traversal, drive names,
case collisions, unknown/link-like records, unsupported formats, oversize
members and aggregate expansion are rejected before extraction. Known Inno
2.0.18 encodes regular files, not symlink members. The extracted tree is checked
again for regular files, complete membership, sizes and checksums before inventory
publication. Final PE/static analysis fails on absent import tables or unresolved
non-system DLLs.

## Validation, incidents and limits

Focused tests cover hash/size sequencing with absent dependent sentinels,
unknown Inno versions, traversal, collision, link-like listing records, member
and aggregate bombs, rounded-size accounting, pre-move complete namespace
validation, interrupted normalization, missing/tampered/symlink payload files,
and malformed/wrong-machine PEs. Initial rejecting controls passed before the
one download, and Inno controls passed before extraction.

Original `--dump` extraction returned success but preserves literal `{app}` and
backslash filenames on Linux; the first inventory correctly rejected them.
The recipe now explicitly validates the complete dump namespace and moves
files into the listed layout, preserving bytes and case without re-extraction
or duplicate payload copies. Original failure and normalization receipts remain
under `evidence/`. A transient host-floor admission rejection occurred before
normalization; a subsequent measured free-space sample admitted it. A naive
accounting walk also rejected concurrent filename moves; the wrapper now uses
the existing bounded, retrying allocated-disk parser rather than ignoring
disappearing bytes. The interrupted same-task move resumed and all 92 checksums
passed. Neither a failed gate nor an early partial result is presented as success.

No browser, guest execution, registration, emulator compatibility, dynamic
LoadLibrary coverage or gameplay was tested. Static completeness does not imply
that the emulator implements the Windows/OpenGL APIs. No runtime box was used,
and no shared registry/source or main branch was changed.
