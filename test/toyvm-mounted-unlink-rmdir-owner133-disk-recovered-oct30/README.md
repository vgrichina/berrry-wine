# Mounted UNLINK/RMDIR type guards

One real production CLI/FUSE case passed on the six unchanged pinned source files in evidence.json. unlink(empty directory) returned EISDIR, rmdir(file) returned ENOTDIR, and rmdir(nonempty directory) returned ENOTEMPTY. Each rejection preserved full namespace metadata and file-content hashes. Sampled stable windows preserved live=28672, peak=28672, written=8, inodes=5. Kernel early rejection is possible; callback coverage is unproven.

Ordinary unlink and empty-directory rmdir succeeded. Live allocation fell to 4096 with one root inode, then rose to 16384 with three inodes for a new directory and a 19-byte file roundtrip. Written bytes rose only from 8 to 27. Sampling is not an instantaneous counter oracle.

fixture.py is supplied inline using /usr/bin/python3 -B -c under the pinned qualify_accounted.py caller, backend, confinement and supervisor. observer.py is the distinct recipe derived from the corrected prior observer; it does not replay CREATE/MKDIR tests. Payload quotas are live262144/write32768/file32768, RSS64MiB, CPU10, wall20, output8192. Parent128MiB, group512MiB, remote floor2GiB plus group, guest case wall90, allocation256MiB including reserve8MiB.

The task Boat was snapshot-stopped after verified mount/process cleanup. See evidence.json for the exact snapshot timestamp and location. No screenshots or game acceptance apply. No source repair, main integration or deployment occurred.
