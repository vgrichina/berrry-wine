# Dungeon Siege thread snapshot boundary

The authorized original EULA acceptance is recorded in
`scratch/runs/20261019-dungeon-siege-authorized-acceptance-2/acceptance.json`:
click163,432 at batch1235837, EULA returned1. The subsequent original call
`CreateToolhelp32Snapshot(4,0)` trapped at EIP00617fc6, return00425ef2.
No persisted registry/VFS export survived the crash; this is not gameplay.

The source implementation captures the existing ThreadManager authority in one
synchronous host/broker call. Main, pending (including booting), suspended and
active threads appear once; duplicate handles do not add entries, and exited
objects retained by handles do not appear in new snapshots. The runtime has
one guest process and sixteen concurrent thread slots; other separately hosted
apps and host OS threads are not part of this guest system. Capacity overflow
fails atomically instead of returning an incomplete list. Without the thread
authority the import fails with120, never a fabricated main-only success.

The existing heap snapshot allocation/list/CloseHandle ownership is retained.
Thread metadata follows heap IDs, with immutable tid/pid/base-priority records
and a cursor owned by the handle. First restarts it; Next advances independently
of the caller's buffer. Threads may close/enumerate the same process snapshot.
The existing shared metadata lock serializes enumeration against close.
The unpublished node releases that lock before the synchronous broker import,
then reacquires it and refreshes its list link before publication. This avoids
making the main guest spin on a Worker-held lock while its RPC awaits servicing.
Invalid handle=6, no more entries/category absent=18, null output=87,
undersized THREADENTRY32=24, allocation/capacity failure=8. Larger buffers get
28 documented bytes and unchanged tails. Success preserves LastError.
Relative priorities map through retained normal/idle/high/realtime process
class; idle/time-critical thread special values use their priority endpoints.

Thread-only flags ignore PID. Mixed heap/thread flags validate the heap target.
Process/module flags remain explicit fail-fast until real enumerators exist.
The existing inherit flag behavior is retained; cross-process handle inheritance
is not newly implemented. Snapshot handles retain the existing allocator-backed
identity convention; this change does not invent permanent unique kernel IDs.

Contracts: [snapshot flags and PID](https://learn.microsoft.com/en-us/windows/win32/api/tlhelp32/nf-tlhelp32-createtoolhelp32snapshot),
[THREADENTRY32](https://learn.microsoft.com/en-us/windows/win32/api/tlhelp32/ns-tlhelp32-threadentry32),
[snapshot lifetime](https://learn.microsoft.com/en-us/windows/win32/toolhelp/snapshots-of-the-system).

Source validation: registry pending/live transition, aliases, retained exited
object, priority classes/endpoints, bounds and atomic failure test passes.
The four changed whole-host-file callback census hashes were reviewed narrowly:
registry capture neither enters nor retains guest callbacks, the default import
returns explicit failure, and browser/broker wiring delegates synchronously.
All four retain their prior pending ownership classification. Census396 and
its mutation tests pass; this does not enable any nonlocal callback API.
The actual PE fixture is authored for both dispatch modes: static snapshot IAT,
dynamic EAT/ordinals, a real CreateThread/spawn/resume/return lifecycle, a child
guest advancing its parent's snapshot cursor, immutability, mixed flags,
CloseHandle and error/write bounds. It has NOT run: compilation/runtime requires
the sole validation allocation. Worker import brokerage is wired, but a real
OS-Worker snapshot call also remains unvalidated. No original game retry or
public deployment is authorized by source validation.

## Required admitted runtime validation

Run `test/test-toolhelp-thread-production.js` normally and with
`--no-tail-calls`, then existing `test/test-heapwalk-win9x.js` and thread priority
regressions under a fresh guarded allocation. The fixture now also creates a
second suspended guest after the first exits, proves the allocator reused its
slot, changes its priority, and checks that old/new snapshots retain distinct
priority values for that reused tid. Double CloseHandle must fail with6.

Before integration, add an actual OS-Worker fixture using the production
Worker backend/broker (the cooperative fixture alone cannot qualify this).
Have the spawned Worker execute CreateToolhelp32Snapshot through its real
import proxy, enumerate on that Worker, and close from main. Pause delivery of
the snapshot RPC while main creates/enumerates/closes a separate heap snapshot;
main must complete before the delayed RPC is released. This directly catches
holding TOOLHELP_HEAPS across RPC and the stale-list-next publication race.
Then drain both snapshots after worker exit and cache-slot reuse, checking
immutability and reachability. Repeat from main and Worker with both dispatch
modes, bounded deadlines and full process-group cleanup evidence. No such
Worker validation has run yet; merge/runtime qualification must say so.

System scope is deliberately limited to the emulator's single-process guest
system. Cross-manager/other-app process census is not implemented. A future
multi-process guest system needs a shared system thread authority before it can
advertise systemwide Toolhelp coverage across those processes.
