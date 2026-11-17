# Win98 global critical section: newly observed shared-heap prerequisite

Fresh original-DLL execution found a new prerequisite before implementing
MakeCriticalSectionGlobal: RPCRT4 requests `HeapCreate(0x04000000, 4096, 0)`
for the heap containing the actual critical section. The current HeapCreate
handler ignores those flags and creates a private heap record. Independent
public-API main and real Worker controls reproduce distinct private records
for repeated shared-heap requests. This is the task's permitted new contract
failure after authorized native work. Synchronization implementation is not
complete; original registrar, factory and service remain unreached.

Evidence is in
`scratch/runs/20261116-sims-global-critical-section-native-implementation/`.
`native-contract-verification.json` checks the public allocation/section chain,
CPU-local Worker identity, six words, stdcall frames, native waits and current
process-group absence. `result.json` records the final scope and exact inputs.

## Actual original boundary

Both independently authored fixtures loaded original objectps.dll SHA-256
`32c6ad91dc66bc12e1273b1e13eb7a15d6e8f63b93447909ca2163dd21b22998`
and original system RPCRT4.dll SHA-256
`f5719c28ce60526cb4873332073c21148ce4c74427197aa6a4438c2951af9c5a`.
The observations run on the CPU dispatching the public API, before forwarding
its logging import; they do not write guest memory.

| Public observation | Main | Real Worker |
| --- | --- | --- |
| Guest process/thread | 1000 / 1 | 1000 / 2 |
| HeapCreate flags / initial / maximum | 0x04000000 / 4096 / 0 | 0x04000000 / 4096 / 0 |
| Returned heap | 0x00660074 | 0x00760074 |
| HeapAlloc size / return | 64 / 0x0066009c | 64 / 0x0076009c |
| Actual MakeCriticalSectionGlobal argument | 0x006600b4 | 0x007600b4 |
| Section offset within that allocation | 24 | 24 |
| DebugInfo / LockCount / RecursionCount | 0 / -1 / 0 | 0 / -1 / 0 |
| OwningThread / LockSemaphore / SpinCount | 0 / 0 / 0 | 0 / 0 / 0 |

The exact argument bytes are
`00000000ffffffff00000000000000000000000000000000`.
Public HeapCreate and HeapAlloc exit ESP values each advance by 16 bytes.
The original MakeCriticalSectionGlobal trap remains the observed endpoint.
Four original objectps main/Worker captures, including the enhanced heap-flags
observer, exited with host status 1 and both output EOFs. Their deadlines did
not fire. These are fresh runs, not reconstructed historical memory captures.

A separate direct-RPCRT4 LoadLibrary control returned the builtin module and
never initialized original RPCRT4. Its host exit 0 is explicitly unqualified;
only the objectps dependency load supplies the genuine original boundary.

## New contract failure and limits

[Wine's Win9x compatibility header](https://github.com/wine-mirror/wine/blob/wine-7.0/include/winnt.h)
identifies 0x04000000 as HEAP_SHARED.
[Its shared-heap implementation](https://github.com/wine-mirror/wine/blob/wine-7.0/dlls/kernel32/heap.c)
returns the common system heap and maps shared backing across processes.
These are primary reference implementations, not a native Windows 98
measurement. The fresh independent main/Worker fixtures check this reference
contract through public HeapCreate calls only: private calls have distinct
identity, while the two HEAP_SHARED calls also incorrectly return distinct
nonzero records. Each fixture reaches guest exit 121. The Worker returns that
code through its actual ThreadProc and main's public GetExitCodeThread call;
its stdcall audit reports zero bad handlers among the checked dispatches.
Host exit 0 for these controls does not mean the guest contract passed.

The original requested shared allocation is now observed. Actual cross-process
visibility, Win98 physical backing, allocator lifetime and locking behavior
remain unmeasured. No claim of real process sharing follows from the section
bytes, public heap flag, numeric pointers, or semaphore reference semantics.
The existing HeapCreate handler's private-record path explains the fresh
control failure; merely promoting LockSemaphore would leave this allocation
contract unresolved.

The next implementation must integrate HEAP_SHARED backing and allocator
ownership/lifetime with the global synchronization authority, then qualify
actual separate-process memory visibility and count conservation. Implement
MakeCriticalSectionGlobal and ConvertToGlobalHandle with source consumption,
remaining references, stale capabilities, close/delete/exit, process/thread
generations, contention, errors, cancellation and caller deadlines. Probe
original initialization, registrar, factory and service only as reached. Keep
Automation, remote QI, final references zero, genuine 60-second waits and the
four previously known failures intact. No bulk stubs or private registry seeds.

## Source, validation and release

The initial ordered wait remained live. GTA2USER2920490 released FINAL;
GLFanEdge2975640 had not released FINAL. At 08:57:11 UTC the coordinator issued
OWNER199_PARALLEL_BASELINE_SCOPE, explicitly authorizing fresh compilation and
read-only actual native boundary work with immutable inputs, without the GL
FINAL or heavy-lock prerequisite for this baseline only. Kernel edits and full
module builds remained gated and were not attempted. The stop reason is the
new native-confirmed heap contract, not that queue.

The baseline uses Git `3bcb7bef7e388ff469cdaa7bb297ecc7a76d3bad` and the recorded
sealed HEAD module SHA-256
`ef7de08a1a1ea564ea7ff2fbd1e3dbbd56cbfc07c19d3db7fcb45c9bac4b5fb8`.
The source view includes only the reviewed released three-line RPCRT4 loader
candidate plus the owned observer/preload; foreign guest-thread-host WIP is
excluded. Each native run copies the verified module into its own sealed
memfd and closes it on actual completion. An independent GNU timeout is armed
before Node starts. All own native PID groups/sessions are absent; no own
server, module holder, lock, worker fleet or box remains.

`test/test-win98-global-synchronization.cjs` now generates ten small native
fixtures and installs the CPU-local read-only observer. The two owned tools
provide the compiler recipe, immutable Git source/module view, public-API
capture and independent native deadline. Eight synchronization/original-load
fixtures compiled in v2; all ten compiled in v4. Only the original-boundary
and shared-heap controls ran. The semaphore promotion, cross-process,
critical-section lifecycle and contention fixtures remain unrun.
The synthetic decoder/observer/forwarding/no-write controls and retained-native
evidence verifier pass. Initial C declaration and authoring syntax failures
remain recorded; subsequent fresh compilations passed.

The exact predecessor patch remains preserved with SHA-256
`8111aad903ce145c1eb77880a5f030cce9440b478df2216dac51ce794490fcc9`.
The earlier original-provider patch remains preserved separately with SHA-256
`eab478eafa2061dc7b1703460ac9a9966ad4fc5c6e3ac2b5045ea7b626b7954d`.
Final Git pins and binary diffs include the owned new files. No source/media
archive or WASM dump is stored in the run. Helpers/test changes stay released,
uncommitted WIP: no code commit or full-build qualification is claimed.
Only this evidence note is committed. No original installer/game ran, no old
closed endpoint was contacted, and no box was created (ID/state/expiry/stop
receipt: null / NOT_CREATED / null / not applicable).
