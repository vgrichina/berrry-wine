# Original Tux Racer 0.61a Win32 recovery (2026-10-28)

The retained original Win32 ZIP has been safely extracted once and independently
read back: **180 entries, 158 files, 22 directories, 13,225,945 expanded bytes**.
Every extracted file's size and CRC match the pinned ZIP's directory; every
read-back SHA256 matches the streamed extraction inventory. No game, installer,
Tcl script, Wine, browser or build was executed. No registry entry or main
integration is part of this change.

The original is retained without a second download or payload copy at:

```
/home/user/wine-assembly/scratch/usage-watch/tuxracer-original-win32-recovery-oct28/payload/tuxracer-win32-0.61a.zip
```

It is 8,009,319 bytes and matches the unchanged supplied SHA256:
`1497e326af9aa591243f4ff1083d4d99de7dc5f0396e37f45ca7bf4f98823c34`.
The predecessor's `payload/download-attempt.json`, `receipt.json` and
`RECOVERY.md` retain acquisition provenance and the original disk failure.
Its final WIP was restored read-only into this task's isolated checkout at
`/tmp/tuxracer-retained-original-closure-oct28/repo`, based on
`1b5c93b2cb998094034cdce7f3eda497cf3c9006`, on
`task/tuxracer-retained-original-closure-oct28`. Only the three new recipe,
focused-test and notes paths are owned; current-main absence was checked.

Official provenance (retained predecessor observations, no new acquisition):

- Project downloads: <https://tuxracer.sourceforge.net/download.html>
- Assigned original: <https://sourceforge.net/projects/tuxracer/files/tuxracer/0.61/tuxracer-win32-0.61a.zip/download>
- Manual: <https://tuxracer.sourceforge.net/manual.html>

The predecessor observed the manual's Windows unzip/`tuxracer.exe` instructions;
its downloads-documentation request timed out. The original's own `README.txt`
also names `tuxracer.exe` and hardware-accelerated OpenGL support.

## Static executable and data closure

All four modules are i386 (`0x14c`) PE32, with no PE delay-import directory.
Imports are matched case-insensitively; all bundled modules are siblings of the
executable in `tuxracer-win32-0.61a/`.

| Module | Bundled imports | Windows/system-runtime imports |
| --- | --- | --- |
| `tuxracer.exe` | `SDL.dll`, `SDL_mixer.dll`, `TCL83.DLL` | `GLU32.dll`, `KERNEL32.dll`, `OPENGL32.dll` |
| `SDL_mixer.dll` | `SDL.dll` | `KERNEL32.dll` |
| `SDL.dll` | none | `GDI32.dll`, `KERNEL32.dll`, `MSVCRT.dll`, `USER32.dll`, `WINMM.dll` |
| `TCL83.DLL` | none | `ADVAPI32.dll`, `KERNEL32.dll`, `MSVCRT.dll`, `USER32.dll` |

There are **zero unresolved direct DLL imports** under that classification.
It does not establish system-library availability on a particular guest.
`DDRAW.DLL` also occurs as an executable string, a possible dynamic Windows
dependency. Dynamic loading and actual API support remain unverified.

The executable names `tuxracer_init.tcl`, `tux.tcl` and `course.tcl`; both root
scripts and the course index are present. A non-executing lexical audit of all
Tcl files follows explicit data-root/common-directory contexts and expands
`$cwd/trees.rgb`, `$course/preview.rgb` and indexed `course.tcl` over all thirteen
shipped course directories. **110 reference groups / 146 resolved paths have
no missing files**. The census covers course elevation/terrain/tree/preview
maps, shared lighting and animation scripts, textures, font metrics and atlas
images, music, sounds and `config/options.txt`. Script comments are excluded.
This bounded audit does not prove arbitrary computed paths, Tcl behavior,
asset decoding, configuration writes or gameplay. The original archive's full
payload and all discoverable references are preserved, with those limits.

## Included license material

Preserved byte-for-byte, with hashes in `data-license-closure.json`:

- `COPYING.txt`: 18,332 bytes, GPL version 2 text, SHA256
  `da0eca0fb517ac939d167924c9d4b3f8750a6b7191932ef2cb145acfa624ac7e`.
- `README.txt`: copyright/source locations and full Tcl/Tk license terms.
- `README-SDL.txt`: SDL attribution, source location and LGPL notice/link.
- `music/readme`: music author attribution.

No standalone LGPL text or SDL_mixer-specific license text was found in the
original. A complete redistribution/source-offer compliance determination is
not made. Preserve the included notices and original archive; this recipe does
not supply missing legal material or publish game binaries.

## Repeatable recovery and acceptance

The recipe uses Python's standard library, pins before metadata/extraction,
and does not execute payloads. Metadata rejects traversal/Windows special
paths, symlinks, special files, case collisions, file/directory collisions,
encryption, unsupported compression/executable prefixes, oversized metadata,
members and aggregate bytes before destination creation. Extraction streams
CRC-checked ZIP members and records per-file SHA256.

Seven focused tests passed **before the sole extraction**. Size/hash failures
propagate nonzero child exits with an absent dependent sentinel. Metadata
controls also assert absent sentinels for aggregate size, traversal, collision,
symlink, special-file and unsupported-compression rejection. PE fixtures cover
bounded imports and invalid RVAs. The supplied hash oracle is unchanged.

Stable task output root:

```
/home/user/wine-assembly/scratch/usage-watch/tuxracer-retained-original-closure-oct28
```

It contains `run.py` (supervisor/admission wrapper), `verify.py` (independent
read-back and static data/license audit), `receipt.json` (canonical closeout),
`full-inventory.json` (all 180 entries), `verification.json`,
`data-license-closure.json`, `payload/inventory.json`, `payload/closure.json`,
`payload/extracted/`, and `ops/` command/admission/stdout/stderr/resource receipts.
The retained original above is a standing read-only input, never recopied.

Commands used, from the isolated repository (fresh admission per operation):

```sh
OUT=/home/user/wine-assembly/scratch/usage-watch/tuxracer-retained-original-closure-oct28
TASK_FUTURE_BYTES=2097152 python3 "$OUT/run.py" focused python "$PWD" /usr/bin/python3 test/test-tuxracer-original-recovery-oct28.py
TASK_FUTURE_BYTES=15728640 python3 "$OUT/run.py" extract python "$PWD" /usr/bin/python3 tools/recovery/tuxracer-original-win32-recovery-oct28.py extract /home/user/wine-assembly/scratch/usage-watch/tuxracer-original-win32-recovery-oct28/payload/tuxracer-win32-0.61a.zip "$OUT/payload/extracted" --max-expanded-bytes 13225945
TASK_FUTURE_BYTES=2097152 python3 "$OUT/run.py" verify python "$PWD" /usr/bin/python3 "$OUT/verify.py"
```

These operation labels and the extraction destination already exist; the wrapper
refuses receipt overwrite and extraction refuses an existing destination. Do not
rerun acquisition or extraction to review the retained result. For a separately
authorized recovery use fresh owned labels/destination and fresh admission.

The canonical dispatch was parsed and bound before dependent work: 749 bytes,
SHA256 `b5fdcea49eab6d982a8984925e81b8b146fa3dae8fb41123da8eb370e600002e`.
The initial host check observed 3,224,637,440 free bytes, enough for three
64 MiB reservations plus coordinator 24 MiB above the 2,982,150,144-byte floor.
Subsequent checks reserve unmaterialized task capacity and full other-worker /
coordinator allocations; already materialized own bytes reduce free space once.
Task charging includes checkout/Git, extraction/evidence, actual session and full
shared WAL conservatively, future growth and the mandatory 8 MiB reserve within
64 MiB. Standing donor objects and predecessor payloads are separately retained.

Python operations use 128 MiB process-group RSS/DATA; Git alone receives
256 MiB DATA, under the 512 MiB physical-group ceiling. The parser-only Node
checkpoint used exact `/usr/bin/node --max-old-space-size=192`, successful startup
with unlimited DATA/AS and a physical-group supervisor. Actual mount argv is
empty; the pinned canonical parser validated a comma-bearing tree control before
checkout. All guarded commands retain CPU 90s / wall 120s / file 12 MiB / capture
2 MiB limits and descendant cleanup. Policy reads and initial wrapper bootstrap
used ordinary shell/Python before the wrapper existed; no blanket whole-task
resource-compliance claim is made. No box was assigned; lifecycle stays with the
coordinator. Publication uses only the exact task branch and configured strict
SSH trust; canonical closeout records the verified remote commit.
