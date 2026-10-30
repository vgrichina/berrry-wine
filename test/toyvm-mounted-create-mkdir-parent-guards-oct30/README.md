# Mounted CREATE/MKDIR parent guards
Candidate: 88b90ff3c7bbafd763e75306d938484a6b98d286.

The single production CLI case uses tiny-fixture with inline Python through the real FUSE mount at /tmp/tvmd/domain, derived from the pinned supervisor. fixture-corrected.py corrects the historical fixture path and asserts a real mount. observer-corrected.py stages its payload as fixture.py and requires observed mount ownership.

All four missing-parent/file-parent CREATE/MKDIR operations returned ENOENT/ENOTDIR respectively and preserved the namespace. Accounting observation windows around the invalid group remained live=8192, peak=8192, written=0, inodes=2. A valid directory/file and 31-byte content roundtrip followed; final live=20480, written=31, inodes=4. Cleanup left no mount or task descendants.

The six source pins, actual syscall results, counters, Python executable hash, limits and stopped snapshot are recorded in evidence.json. This establishes only the mounted namespace gate. Backend callback coverage is not established because the kernel may reject invalid parents earlier. No gameplay acceptance, synthetic backend replacement, RENAME/READDIR replay or production edits.

Execution: stage the exact sourcePins paths, the corrected observer as /tmp/tvmd-stage/observer.py, the corrected fixture as fixture.py, the verified cancellation receipt and a current finite-TTL manifest. Invoke /usr/bin/python3 -B /tmp/tvmd-stage/observer.py preflight, then guards through supported Boat API exec. Keep all prescribed admission, allocation and runtime controls. Raw recovery evidence and a separate patch/recipe reside in the task capacity-recovered output directory; Boat bx_mjxycjep retains /tmp/tvmd-stage in its verified stopped snapshot.
