# Rename onto an open destination: prescribed gate FAIL

Candidate: `5a88ca099b962e946160afd2d4d71a950bf46db3`.
Exactly one actual unmodified production `qualify_accounted.py` invocation ran on task-owned Boat `bx_su4mgbyb` via supported API exec. No source, fixture, observer or quota was changed; no retry, repair, other acceptance group, browser or gameplay execution occurred.

The CLI exited 1 with exact stop/failure reason `filesystem allocation limit`. The before-C-write marker proves the replaced B descriptor remained open, had zero links and size 8192, while the new B path pointed to A. The pinned fixture asserts distinct old-B b/new-A a reads before the marker. C's attempted 4096-byte growth was rejected. Peak was 32768 and written was 16384.

The prescribed acceptance gate nevertheless failed: the post-reap filesystem receipt reports live **20480**, versus required **12288**. It reports three inodes and zero handles. There is no `filesystemFinal` field. These values describe the post-reap snapshot, not instantaneous usage at rejection.

Source-backed oracle error: root metadata 4096 + renamed A metadata/payload 12288 + empty C metadata 4096 = **20480**. Before C growth, the open replaced B adds 12288, making 32768. Collection on B's final release subtracts 12288, not 20480. The source's `collect` predicate requires both zero links and zero opens; rename decrements links and release decrements opens. The expected post-reap 12288 omitted linked inode metadata. This arithmetic should have been caught during mandatory pre-invocation review; the worker incorrectly endorsed it and consumed the single invocation. No revised acceptance or PASS is asserted, and no second fixture is authorized here.

The authoritative CLI cleanup receipts and observer show all recorded owned PID/start identities absent, no remaining FUSE mount, unmount exit 0, server exit -15, and no emergency/external cleanup. Production source pins match before and after. Browser allowance remains CPU 35.353183, wall 101.495550694, capture 1.

Evidence was recovered before snapshot-stop. Boat `bx_su4mgbyb` is verified actually stopped with a completed snapshot; see `evidence/actual-stopped.json`. Creation was 04:50:40 UTC, expiry 05:20:40 UTC, scheduled shutdown 05:18 UTC; actual stop completed before handback. The first immediate stop-state query observed stopping; a later read-only query established stopped. No stop retry occurred.

Recovery: use the saved Boat snapshot and committed evidence. Do not resume or repeat this invocation without a new coordinator assignment. Any future acceptance requires coordinator review of the incorrect final-live oracle. Preserve prior historical FAILs; this test does not retroactively accept them. Root messageboard publication is delegated to the coordinator through the bounded publication note.
