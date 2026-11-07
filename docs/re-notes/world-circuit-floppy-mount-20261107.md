# World Circuit: native DOS floppy volumes and first real copy attempt

Run: `scratch/runs/20261107-world-circuit-floppy-mount/`; owner Telegram177.

Native ToyVM now supports distinct read-only A:/B: FAT12 image volumes and
explicit disk changes. **World Circuit installation remains incomplete; no
installed game entry, Quick Race, Main Menu or driving is verified.** The one
original runtime reached an actual MPSCOPY failure after copying four genuine
setup files. No corpus registration changed.

## Interface and DOS behavior

`createMachineRunner({ ..., floppies: [['A', imageBytes], ['B', imageBytes]] })`
mounts original image bytes. Between steps, `runner.changeDisk('A', nextImage)`
inserts a disk; `null` ejects it. `Machine.changeDisk` is the corresponding
filesystem interface. C: remains the existing writable in-memory overlay;
its relative keys stay compatible with existing callers. A:/B: have separate
namespaces and per-drive current directories. Selecting a drive, changing
another drive's current directory, drive-relative paths and root-relative
paths retain their DOS meanings. Child EXEC uses the same mounted volumes.
Executable environment paths now retain their actual drive and directory.

`tools/toyvm/fat12.js` parses BPB geometry, FAT12 cluster chains, original short
names, nested directories, attributes and file contents. Final searches also
return original FAT modification timestamps. Images are detached before
parsing, never written back or extracted into C:. Bad geometry, differing FAT
copies, cyclic/cross-linked/out-of-range chains and oversized files are refused.
Parsing finishes before a replacement becomes visible. Existing open handles
retain their original byte snapshot; new opens and searches use inserted media.
Unmounted/invalid drives retain the prior C-only behavior (unavailable selection
leaves the current drive; current-directory error 15; invalid free-space AX=FFFF).
Floppy create/write/delete/attribute mutation is denied. DOS mkdir creates
actual C: output directories; guest directories participate in checkpoints.
No BIOS FDC or controller behavior was added speculatively.

## The original installer run

The [source note](world-circuit-v103-source-20261107.md) pins the three original
images. Disk 1 was mounted at A:, and INSTALL.EXE's exact original bytes were
loaded through the native cooperative runner with default devices and clocks.
Full Game Installation, source A:, and `C:\MPS\GPRIX` were chosen through
ordinary keyboard input. Source selection/path input takes substantial guest
work to process. A later A keystroke entered the path field; Backspace and
ordinary typing corrected it before confirmation. All 38 commands received
exact sequence ACKs, including every independent UP and final quit; zero UNKNOWN
input outcomes or replays. No guest/config/clock/private-handler changes.

INSTALL.EXE performed real DOS mkdir calls and EXEC'd `A:\MPSCOPY.EXE`.
MPSCOPY copied MPSLABS.IDX (5,892 bytes), MPSCOPY.EXE (84,210), INSTALL.EXE
(96,163), and README.TXT (5,694) to the destination. Retained bytes match the
original FAT source files exactly (`partial-output-verification.json`). These
are setup files, not a completed game installation. No GP.EXE or packed game
payload was fabricated. The original did not request disk 2 or disk 3, so no
runtime media swap was performed; swaps were verified with small DOS fixtures.

MPSCOPY then emitted:
`Error: failed to open master index file: C:\MPS\GPRIX\MPSLABS.IDX`
and exited 3. The parent displayed **WARNING: INSTALL INCOMPLETE**. DOS had
successfully returned handle 20 for that open. The child's preserved memory
and disassembly prove its C runtime compares BX against DS:0CE7, which contains
20; at code offset 18CB it rejects handles >=20, closes them and reports the
open failure. Native DOS's old monotonically increasing handle allocation had
not reused the many closed handles. This is a concrete host DOS bug, not an
invalid source image or a reason to bypass the installer. The final source
fixes handle reuse with a failing-before/passing-after regression. The one
original runtime was not restarted with that correction; original installation
must be rechecked in a separately authorized run.

A read-only retrieval listing initially failed with a confirmed
`IsADirectoryError` after the installer created its output directory. A corrected
recursive file inventory recovered and verified the evidence; no guest command
was retried or had an unknown outcome. Unhandled services and CPU faults were
empty at the installer failure.

## Validation and provenance

`test/test-toyvm-dos-floppy.js` runs focused contracts against Node and both
shipped browser bundles, plus a small real native DOS parent/child. It covers
mount/change/eject, invalid/unavailable drives, independent cwd/path behavior,
FAT file hashes, subdirectory searches and timestamps, immutable media, failed
replacement atomicity, read-only writes and reusable handles. The production
fixture EXECs its child from A:, reads floppy data, creates C: directories and
writes the data under C:\MPS\GPRIX, then checks media/checkpoint restoration.
The optional `WORLD_CIRCUIT_MEDIA=scratch/game-media/world-circuit-v103/disks`
mode checks all original image hashes and records every actual FAT source file
hash without needing proprietary media in ordinary CI. Existing C: path,
file/device, rename and native checkpoint regressions and the mandatory locked
build were run; see the final validation record in the run.

The original runtime used base Git SHA
`78475a74074b1be195ca5f8d81b68aba939c8848` plus `relevant-source.patch` and
`runtime-new-fat12.patch`. Its precise 140 runtime/media/helper pins are in
`runtime-pins.json`, rechecked remotely after execution. Later handle reuse,
environment-path and FAT timestamp/checkpoint refinements are final-source
changes, not claims about that original run. Actual native module:
`b6bacd0b52e72aea90a1ddad6016d07b59f4102de3dba720c66c5d3d855c9550`;
Node v24.22.1, V8 13.6.233.17-node.58. The module and boundary memory are retained.

163 terminal remote file references totaling 9,104,067 bytes were retrieved and
SHA-256/size verified before normal shutdown, including unique captures, logs,
commands and partial installer outputs. Earlier distinct memory captures are
also retained. Images stayed byte-identical. There are no source/media archives.
Recovery uses the Git SHA plus relevant patches and the pinned original image
paths; recover the four unique guest outputs from `retrieved/output2/installed/`.
The run's recovery recipe separates initial runtime and final source revisions.

One UUID created **bx_d8mt7n2u**, initially expiring **2026-11-07T23:16:45.456Z**,
with >5 GB free and detached observable normal-stop/25-minute watchdog delegates
armed before allocation. Final quit released all keys and the only guest PID
5956 was absent before stop. Normal stop **stop_215de21480162159** completed at
**2026-11-07T22:55:31.915Z**, `forced:false`; final state **ARCHIVED**, expiry
null. Both delegates exited zero; supervisor finished with no remaining child.
No ports or browser profiles were opened. The owned board watcher was retired
at closeout; box custody returns to the coordinator, without resume/delete.

Next: run the original installer with the final handle-reuse correction, follow
its own disk prompts using `changeDisk`, then verify actual installed entry and
media before registration or ordinary Quick Race/driving. No public deployment,
FPS, audio or parity claim is made.
