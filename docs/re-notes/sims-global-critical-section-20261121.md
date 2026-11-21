# Sims global critical-section authority

Run: `scratch/runs/20261121-sims-global-cs/`.

`MakeCriticalSectionGlobal` now promotes an initialized HEAP_SHARED section
at the system byte authority. Enter/TryEnter/Leave/Delete use that same
authority. Promotion is idempotent and publishes a generation-bearing
LockSemaphore reference; changing a numeric handle does not create sharing.
Private linear-memory sections retain their existing implementation.
An unpromoted section in the shared arena remains private to its process.

The authority serializes ownership, recursion and a FIFO wait queue, including
LockCount's queued waiters. Ownership includes native process birth, guest
process ID and guest thread ID, so colliding TIDs in separate processes cannot
recurse. Browser routing identifies the process by its actual backing memory
and guest process ID. Node's process-birth adapter currently requires Linux
`/proc/self/stat`; other native hosts need an equivalent lifetime identity.

A contended Enter parks with the existing yield-9 EIP/ESP contract. Repeated
retries register one waiter. Final Leave reserves ownership for the first
waiter; its retry consumes that grant exactly once. No guessed timeout steals
a live lock. The existing thread-retirement export cancels its shared waits
and releases its ownership. Transport disconnect retires only the departed
session's waits/owners and wakes a survivor. Global objects and their backing
allocation survive creator exit within the system namespace's existing
lifetime. This follows the emulator's established exit cleanup policy; it is
not a native Windows measurement of undefined owner-death behavior.

Delete and HeapFree retire the section generation. A parked retry cannot
acquire a replacement section at the same address. Invalid/nonowner shared
operations fail explicitly. The LockSemaphore reference is owned by this
section authority; general standalone global semaphore/handle promotion is
not implemented. The old ConvertToGlobalHandle numeric identity stub now
traps, exposing that boundary instead of silently claiming promotion. Private
memory cannot become shared by calling MakeCriticalSectionGlobal.

## Validation and original progress

The old code fails actual shared-section entry on native main, real Worker
and separate process with `ESHAREDHEAP_LINEAR_ACCESS`. The new public-handler
controls pass all three, with separate process memories, recursive ownership,
three-CPU conservation of 192 protected increments, FIFO reservations,
nonowner rejection, repeated parking with stable ESP, waiter cancellation,
creator-process exit, deletion/reinitialization and stale retry rejection.
A browser-script authority control checks separate process memories with
colliding TID 1 and explicit guest retirement. This is not a browser capture.

Private section state checks pass 26/26; the existing aligned/packed
multithreaded Enter/TryEnter regression, shared heap including actual x86 LOCK,
named-event authority and browser yield regressions pass. The canonical
`flock /tmp/wine-build.lock bash tools/build.sh` passes. The older Worker-DLL
VM test fails before exercising waits because its context omits RenderWorker
and guest-worker.js reads CommandWriterHandoff; those files are unchanged.

The bounded original RPCRT4/objectps startup uses the same original DLL hashes
and explicit mounts documented in `sims-shared-heap-20261121.md`. RPCRT4
initializes and promotes sections at 0x80000018, 0x8000005c and 0x800000b0.
Each begins with `[0,-1,0,0,0,0]`; promotion publishes a distinct authority
reference. Original objectps loads and unloads; the fixture exits with guest
code 0. The prior MakeCriticalSectionGlobal trap is removed.

One additional bounded fixture calls genuine objectps DllRegisterServer,
then would call its DllGetClassObject. It resolves actual exports 0x0065a090
and 0x0065a000. During the registrar call original RPCRT4 repeatedly resolves
OLE32 CoGetClassObject and the absent CoGetMarshalSizeMax; the latter returns
zero at return address 0x0050b4c0. Execution ends at the unchanged 20-second
limit without a registrar result or factory call. This is the observed next
boundary, not registration/service/installation/gameplay success. No replay
or broad synchronization qualification follows it.

Run-local logs, finite supervisor receipts, input hashes, exact Git/diffs,
fixture source/executable and tested modules retain the evidence. No media
copies, Wine, Python, worker spawning, remote box or public deployment.
