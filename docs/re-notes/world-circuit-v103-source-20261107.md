# World Circuit v1.03 original disk intake, 2026-11-07

Owner Telegram177 requested Formula One Grand Prix from an X post. The
[demo runs](world-circuit-driving-20261107.md) render but drain/discard BIOS keys,
so automatic scene motion is not driving proof. A separate original disk-set
candidate is now recovered for an interactive installation investigation.
No installer or game from this disk set has been executed.

Source: https://archive.org/details/world-circuit-v-1.03-1992 . Its metadata
identifies an IBM/MS-DOS release on three1.44MB disks. Package:
`https://archive.org/download/world-circuit-v-1.03-1992/World%20Circuit%20v1.03%20%281992%29.zip`,
8122052 bytes, SHA-1 `ec420687111fbff0b3a5a5bd08f0886c9d06efc0`, SHA-256
`e76a189120a84f46425f33ab090072c70a02dc9df9582572f84993433550e341`.
Downloaded bytes match metadata size/SHA-1. Local path:
`scratch/game-media/world-circuit-v103/World Circuit v1.03 (1992).zip`.

The ZIP contains IMA/IMG pairs of three floppy images. Each pair is byte-identical;
only the IMA member of each pair was extracted under
`scratch/game-media/world-circuit-v103/disks/`. The original ZIP remains intact.
All images are1474560 bytes:

| Image | SHA-256 |
| --- | --- |
| DISK01.IMA | `302fc69b10b31fca68b05f0d9b74f9f384f727dac38963308558f78e55d079c8` |
| DISK02.IMA | `b5ebe98c2cea4d54ca6bb4f8ae2fcbb2392dbcf1d81186ce4c6f0a3561c5c6d5` |
| DISK03.IMA | `a5047fa95d1541bc2c2b365215bad1f25e1bcede8735cd990b028c7490f63f43` |

Read-only FAT12 inventory finds INSTALL.EXE, MPSCOPY.EXE, MPSLABS.IDX,
README.TXT and F1GP.001 on disk1; the other disks hold F1GP.002/.003.
The unmodified README identifies version1.03 and describes native Quick Race
and Main Menu entry paths, supporting investigation of an interactive version.
Its actual installer behavior, resulting entry executable, controls and driving
remain unverified. No installed-state files were synthesized.

Evidence: `scratch/runs/20261107-world-circuit-interactive-source/` contains
archive metadata, package/member CRC/size inventory, disk hashes/root directories
and the read-only extracted README. Source media stay ignored; no redistribution
permission, freeware status or public deployment is claimed. Recovery begins with
the pinned ZIP and original installer, not a modified executable or copied demo.
Next task should preserve this source set and inspect/execute the original DOS
installation workflow on a fresh separate box before registering actual installed
payloads in the native ToyVM corpus. Retain any real setup/device blocker.
