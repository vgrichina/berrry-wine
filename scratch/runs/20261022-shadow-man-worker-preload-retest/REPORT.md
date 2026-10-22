# Observer ownership proved; single retest blocked by bounded storage

**OFFLINE_CAUSE_CONFIRMED_AND_GUARDED; GUEST_BLOCKED_ENOSPC.** The actual
retained `ThreadManager.namedEventEnvironment()` with the original preload
threw `ETIMEDOUT`. Its real authority Worker subsequently emitted `EEXIST`
from observer `fs.openSync(...parent-45663.jsonl, 'wx')`, sharing the parent PID.
The error stack is in `offline-original-api.json`; this is experimental cause
evidence, beyond the predecessor's unqualified deadline. The production
authority's existing empty error listener masked that exception until its
synchronous deadline. No authority, thread-manager or runner code was edited.

The only observer mechanics change wraps its entire instrumentation body in
`if (require('worker_threads').isMainThread) { ... }`. Ordinary fork children
are main threads, so their observer, fork wrapper, module hook, API tracing,
PNG and exit mechanics remain intact. No execArgv stripping, deadline change,
fake authority response or guest-gate bypass occurred. Exact original and guarded
hashes and the two-line insertion diff are in `observer-hashes.json` and
`observer.diff`. Original here means the predecessor's ROOT/OUT-relocated observer:
SHA256 `d8a8667502500933a43a68b1f696ee3dc2d23e64c77063b209204eb5740a0cf9`;
guarded before this task's OUT relocation:
`13cabb8b1d0db82db41ef33a6ae0e26192937f2389b57c66f19f867625648bfe`.
The actual guest observer SHA256 is
`4aef678ccd68cdd875071d66c6d4ff02e46939c3226a27bdf28817a05caa724f`.
Reversing the inherited ROOT/OUT relocation yields the original pinned
`539c9fd0d23b6c539818ee9c612d33b010708af74c91f896a9f9f68988b2769d`.

The guarded preload passed actual retained authority hello/create/open/set/
reset/acquire/close/shutdown requests, first without fixture imports. A second
offline fixture exercised those same real requests, then real `cp.fork` with
inherited preload: parent45817, child45826, distinct PID-owned preload/module/
exit rows, actual raster canvas PNG encode/decode and first-ShowWindow stop.
Only that PNG fixture supplies synthetic API imports/exports; it executes no
guest and is never used by the guest launcher. Removing the guard reproduced
the actual Worker `EEXIST` and `ETIMEDOUT` (PID45837). All receipts are retained.

## Single original guest result

At 19:03:36 UTC, original Setup parent **47137**, PGID47137, forked the genuine
557056-byte `_INS5576._MP` to Node child **47145** (guest transport PID4004).
Its payload SHA256 is
`a8657371f03e2e66db951c3dcd3aeb42c576894908ca2eb1b3806aa0404cb083`.
Parent WinExec returned33 for this first launch: transport acceptance only.
The child actually executed the inherited guarded preload and exclusively
opened its own log. Both /proc and preload argv identify it; inherited real
ticks, trace flags, temp paths, and the unchanged historical module are recorded.

The first exact parent launch failure was:

```
[spawn] ShellExecute "C:\_ISDEL.EXE" failed: ENOSPC: no space left on device, write
```

This is the original parent's subsequent cleanup-helper launch, not a retry.
It failed during full-VFS transport writing, before a second fork. Parent's
second WinExec returned0. The external observer detected that line at
0.587318169s and terminated its owned process group; total elapsed
**0.700945390s**, parent OS exit **1**, remaining owned processes **0**.
The parent also encountered ENOSPC in `saveVfsToHost` while exporting at exit.
The unchanged child's cleanup callback logged **0 writes,81 deletions,0 registry
keys** after termination; this is a callback result, not a valid child output.
Parent export is incomplete: **74 files/74516014B**, including partial payload
where the quota refused further writes. Its inventory records exact bytes.

Counts for this task: **one original Setup attempt, one OS fork, one child
preload, zero child module-instance/load evidence, zero child windows/PNGs,
zero observed child/parent guest ExitProcess events**. Child OS exit/signal was
not independently reaped by the external launcher and remains unknown; all
owned processes were confirmed absent. Parent module-instance count is one.
The child was terminated before its guest load could be established. The
inspected `raw/parent-47137.png` is parent-only preparing-InstallShield/splash
evidence, with no error dialog; it cannot substitute for a child screen.
Full untruncated output is 71448B. No authority deadline occurs in this run.

ENOSPC is an actual **storage-bound result**, not proof of installer
incompatibility or memory exhaustion. No capacity increase, second guest
attempt, repair of the next dependency, input or licence Accept was performed.

## Allocation, identities and preservation

Before reuse, ordinary cross-device copy preserved **93 files/106214876B**
from old `attempt` to the existing recovery allocation. Every file hash matched
and the source was rechecked before removing only that verified tmpfs tree.
All old **80 parent-VFS files/75603833B**, including remote-only payload bytes,
survive at the inactive path in RECOVERY.md. No binary was pulled locally,
truncated, discarded or repacked. Recovery allocated bytes went from771149824
to877645824; the conservative cross-device transient projection878657536
remained below2147483648, with host reserve above2982150144 throughout.

The same tmpfs remains **150994944B/16384 inodes**. Fixed active allocation is
**85536768B** (85024432 logical), below96MiB. Fixed allocated + hard quota +
untouched16MiB reserve = **253308928B <268435456B**. Peak observed tmpfs use
was **146366464B**; ENOSPC proves a write exceeded available quota between
samples, so observed peak is not claimed as an exact high-water mark. The
conservative hard peak bound is the full144MiB quota. Final quota use75358208B
includes retained runtime/offline evidence. All mutable runtime paths, recursive
transports, environment TMPDIR/TMP/TEMP and cwd were inside the quota. The
actual retained Node fork/socket inheritance fixture passed. The previously
accepted full-write tmpfs enforcement proof was not replayed.

All **243** original/runtime/support/codec pins matched pre/post/cleanup.
Setup SHA256 `5656e87da0641c9dcfcd0ee8949ce72b3fa6a7d0e8b1fd985a16f6bd6c34ce52`;
module1878971B SHA256
`f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`.
Host13bb92cd2e1bc060ff908722843d1e97a439b1a4, candidate30bdd15,
source0a130dc, retained closurea0236c. This qualifies **historical wasm
compatibility only**, never source-equivalent canonical compilation.

Cleanup removed only the cheap fork fixture's ordinary file/directory. All
new guest evidence and the inactive predecessor copy remain; tmp transport
directories were already removed by the unchanged runner. Final recovery
allocation877649920B, host free48179462144B. Protected root/donor Git
HEAD/index/config seals match. Local allocation is recorded separately,
including Git, scripts/evidence and reserves. No production code, build,
recovery/download, repack, merge, other worker or compute lifecycle operation.

Box **bx_495585da is left RUNNING** (API idle, health ok, stop null), expiry
2026-10-22T20:13:56.453Z. Coordinator retains shutdown19:50 ownership;
handback is before19:40. No resume/stop/delete action. This bounded task ends
at the concrete ENOSPC blocker. Publication receipts and the append-only
messageboard record exact commits/remote verification; no further retest.
