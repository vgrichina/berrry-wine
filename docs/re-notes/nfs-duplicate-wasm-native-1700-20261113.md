# NFS follow-through: duplicate WASM pool cannot establish disk floor

The distinct generated-WASM pool is insufficient. A bounded, read-only
inventory of `scratch/runs/**/*.wasm` completed across 52,470 directories:
210 paths, comprising 190 regular files and 20 symlinks. Symlinks were
excluded without following them. The initial 50,000-directory bound stopped;
the completed inventory used explicit limits of 250,000 directories and
45 seconds. No other file pool was inventoried or cleaned.

Full SHA-256 and size grouping of the regular files found 53 distinct inodes
and 17 distinct byte sequences. A second complete hash pass verified those
groups and stable inode, size, mode, nanosecond mtime and link count. Most
apparent duplicate modules already share hardlinked allocations. Summing
each pathname's blocks would misleadingly count the same allocation many
times. No hardlinks or symlinks were created or substituted.

Even assuming **every regular path were closed and had no runtime
dependencies**, the maximum reclaimable allocation is only **4,521,984
bytes**, while preserving an existing original of every byte sequence.
This upper bound excludes inodes with links outside the inventory from
reclaimable allocations, and retains one inode per hash/size group when
all its links are inside the inventory. Closure and dependency exclusions
could only reduce the result. Two full-sized duplicate allocations account
for 4,382,720 bytes; small generated fixtures account for the remainder.

Available disk at the pool measurement was 1,492,353,024 bytes. Adding the
entire optimistic upper bound gives 1,496,875,008 bytes, still 3,124,992
bytes below the strict 1,500,000,000-byte floor. This is newly bounded
evidence from the authorized pool, not a repeated native-launch decision.
No closure, FD/maps scan or deletion eligibility is claimed. No exact
removal paths were claimed, no files were unlinked, and no recovery index
or restore implementation is needed. All original modules, unique bytes,
existing retained dependencies and recovery recipes remain untouched.

Evidence: `scratch/runs/20261113-nfs-duplicate-wasm-1700/`, including metadata,
full-hash groups, validation, Git SHA and relevant binary diff. The twenty
O_NOFOLLOW refusals in the first hash report correspond exactly to the
twenty metadata-classified symlinks; validation confirms all 190 regular
paths were successfully hashed and reverified. No source/module archive,
media copy, raw-log encoding or other cleanup occurred. Restore earlier raw
logs before historical consumption using their existing recovery recipes.

Both NFS1550 and NFS1640 notes were read. The bcd413390 actor resolver,
unchanged chooser export and local media were not modified. No heavy lock,
runtime child, watchdog, input or box was created because this pool cannot
meet the prerequisite. Actual UI-actor inspection/bind, two reviewed
Pause/Continue frames/worldtimer, and a reviewed >=1500 ms held driving
frame with independent UP/Escape remain unproved. No guest/config/clock/AI
writes, autopilot, UNKNOWN replay or forced presentation occurred.

Next requires a separately authorized material resource change that can
establish sustained headroom. No unchanged-floor retry is justified by
this pool. No production change or build was required; validation covered
the inventory, complete hashes, allocation arithmetic and own-note diff.
Box ID NONE; state NOT_CREATED; expiry null; stop receipt N/A.
