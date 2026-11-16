# Secondary ThreadProc return sentinel, 2026-11-14

Secondary ThreadProc return is now distinguished from unexpected EIP zero by
an instance-local record written by the actual x86 RET handlers. Both
cooperative and Worker schedulers preserve the returned DWORD, run normal
DLL_THREAD_DETACH once, and retain the existing retirement and stack ownership
barriers. NULL transfers and corrupt return frames remain faults. Explicit
ExitThread retains its own terminal yield and exit code.

Evidence is in `scratch/runs/20261114-thread-return-sentinel/result.json`.
Git commits plus the recorded binary patches are the source archive; no source
tree, game media or WASM copies were bundled. No new original application run,
browser, remote box, performance variant or deployment was used for this task.

## Original evidence and its limit

The construction run's `original/native.stdout.log` reports Thread 3 starting at
`0x7b7100`, then twice reaching EIP zero with previous block `0x7b7180`,
ESP `0x7ee00000` and EAX zero. Storm's runtime base `0x79b000` and preferred base
`0x15000000` map that block to original `0x1501c180`. The retained disassembly
shows register pops, `xor eax,eax`, and `ret 4` at `0x1501c186`.

This is consistent with the ThreadManager's zero return word at stackTop-8 and
a normal stdcall return. It does not prove which transfer occurred historically:
previous EIP names a decoded block, and the old log lacks an authoritative
consuming-RET record. The original cause remains unproven. Its fourteen
abandoned critical-section enters and active T2 remain separate unresolved
diagnostics. Neither native process exit zero nor this classification repair
proves all threads shut down cleanly.

## Mechanism

The host arms the secondary instance with its seeded return slot. Plain RET,
RET-immediate, and fused pop/RET record the actual target and pre/post stack
addresses before mutation. Normal return requires target zero, consumption of
that exact slot, and final ESP eight bytes above it: the return address and one
ThreadProc parameter. A NULL CALL/JMP cannot write the record. A different
return slot or wrong argument cleanup cannot qualify. The main instance stays
unarmed. No application address or epilogue byte pattern is whitelisted.

The schedulers read this record before DLL detach, saving EAX as an unsigned
DWORD before callbacks can change registers. Unexpected EIP zero retains its
register/previous-EIP diagnostics, retires with fault code 1, and does not invoke
normal guest detach. Existing actual trap diagnostics remain separate. Older
external WASM modules without the record exports cannot certify a normal return
and take the unexpected-zero path. This is deliberately conservative.

## Tests and source adoption

The same production ThreadManager fixture ran against the exact untouched
incoming code and the repaired build. It loads a real PE, executes real x86
ThreadProcs, resolves public WaitForSingleObject/GetExitCodeThread, and loads a
real DllMain that counts DLL_THREAD_DETACH in guest memory. It exercises
cooperative instances and actual GuestThreadHost Workers.

Before the change, both nonzero return values were lost and NULL/wrong-stack
zero transfers could report exit success and run normal detach. The normal-return
assertion failed against that exact before-code. After the change, all 22 cases
pass across both backends: return 0, return `0x87654321`, fused return
`0x12345678`, indirect NULL call/jump, stack-balanced NULL jump, corrupt zero
return, wrong RET cleanup, corrupt nonzero return, actual trap, and ExitThread.
New handles report STILL_ACTIVE and unsignaled waits; finished handles expose
the correct DWORD. Normal and explicit exits detach once; faults do not.
Actual allocator retirement reclaims the mapped stack without replaying detach.

The released 08:45/09:07 ThreadManager cleanup WIP was preserved before editing,
fully reviewed and adopted as a complete file, together with its 22-test
regression. Its exit fence, independent resource retries, once-only notifications,
cancelling owner retention, permanent exact cancellation-fault quarantine and
incomplete-cleanup slot barrier remain intact. No partial ThreadManager staging
was used. Canonical manager, DisableThreadLibraryCalls, real DllMain and scoped
loader main/Worker, bootstrap retirement, stack lease, Worker scheduler, sparse
Worker stack, and seven adjacent cleanup suites pass.

One bootstrap fixture's notification-flags case previously manufactured EIP zero
with no RET proof. It now uses explicit terminal yield for that case; real x86
return proof belongs to the new regression. Its other lifecycle modes and
readiness/retirement deadlines remain intact. The real Worker suite ends with
zero owned Workers remaining.

The full build passed under both heavy and build locks. Five producer census
rows were reviewed. A separate census check covers HEAD plus the complete owned
producer files and only those rows, as well as the shared working tree. Foreign
census edits are preserved as an exact restoration patch and are excluded from
the commit. Test processes have actual waits and EOF records with independent
prearmed watchdogs; no deadline was extended to obtain a passing result.

This is a crash-classification and thread-exit repair. StarCraft startup/native
Quit after the change was not rerun. No FPS, audio, parity, full-suite or unrelated
shutdown claim follows. Box ID and expiry are null, state is `NOT_CREATED`, and
the stop receipt is not applicable.
