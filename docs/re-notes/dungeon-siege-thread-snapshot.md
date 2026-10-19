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
sixteen concurrent thread slots per process. A manager alone cannot enumerate
the host's child-process system: incomplete scope now fails with50 before
writing any record. Browser scope becomes permanently incomplete for the page
when a second WineAssembly is constructed or a process/ShellExecute launch is
requested, before asynchronous child startup. All parent, child and sibling
managers consult that same flag. CLI child/pipe/IPC callers start incomplete;
parents become incomplete before launch attempts. This deliberately includes
failed launches and remains conservative after child exit; no completeness is
inferred from an empty local child list. Capacity overflow
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
OS-Worker snapshot call is authored but remains unvalidated. No original game retry or
public deployment is authorized by source validation.

## Required admitted runtime validation

Run `test/test-toolhelp-thread-production.js` normally and with
`--no-tail-calls`, then existing `test/test-heapwalk-win9x.js` and thread priority
regressions under a fresh guarded allocation. The fixture now also creates a
second suspended guest after the first exits, proves the allocator reused its
slot, changes its priority, and checks that old/new snapshots retain distinct
priority values for that reused tid. Double CloseHandle must fail with6.

`test/test-toolhelp-thread-worker.js` now authors an actual OS Worker using
the production synchronous import proxy/broker, compiled module, PE exports
and x86 API calls. The test delays capture RPC, interleaves main heap snapshot
creation/enumeration/close, retains another list head, then resumes the Worker
and checks both snapshots remain reachable. It exercises shared enumeration,
retained priority after registry exit/reuse,64 repeated broker failures for
each of8/50/120 with staging reuse, and1024 enumerations racing main close.
The Worker fixture installs its real Worker in the manager registry explicitly;
the companion production fixture covers CreateThread/spawn/return lifecycle.
Neither new native fixture has run. Execute both dispatch modes with bounded
outer process-group deadlines (a bad lock can block main's event loop), and
retain cleanup evidence before claiming qualification.

Cross-manager/other-app process census is not implemented; incomplete system
scope returns ERROR_NOT_SUPPORTED, never local-list success. A future
multi-process guest system needs a shared system thread authority before it can
advertise systemwide Toolhelp coverage across those processes.
