# JS COM callback ownership — source checkpoint, 2026-10-20

Base: `8580f3aac0fac2b15e932c931620e0491d86b8a8` (`origin/main` at assignment).
The ICM, RichEdit and WinHelp ownership implementations already landed and
were not modified. The older callback census prose still lists JS COM as
pending; the actual `lib/storage.js` bridge did lack retained token ownership.

## Carrier and correction

The concrete carrier is the synchronous JavaScript activation record around
`_runComCallback`: CreateInstance, factory AddRef/Release, and the legacy
DllGetClassObject activation path retained EIP/ESP/SEH while reentering `run`.
They restored those values even after incomplete calls or exceptions, without
an invocation identity. CreateInstance additionally treated a nonzero output
pointer as success before completion; lifetime calls swallowed exceptions.

All three now use `_invokeComCallback`. It acquires a child through
`com_callback_enter` / the existing sync-depth helper before guest mutation,
retains the exact i64 token as a JS BigInt, and validates the instance, memory,
process/thread-slot owner and expected top token around each run slice.
Ordinary slices preserve the token; nested and equal-depth sibling calls use
distinct children. The JS frame retains all eight integer registers, EIP,
handler disposition, steps, yield state, and the existing SEH-head snapshot.
Nested execution starts with cleared handler/step/yield state.

Only an exact zero sentinel with no blocking/exit reason is completion.
The completed HRESULT is preserved, including failure with a published pointer.
The checked leave validates the expected child before changing sync depth and
spill pins; only then is the parent state restored. A thrown guest error,
incomplete callback, stale owner, replacement instance/memory or mismatched
token propagates without popping/restoring. There is deliberately no catch or
finally that silently resumes an abandoned parent. Explicit process/thread
retirement remains the way to discard abandoned invocation state.

DllGetClassObject temporary allocation/writes occur inside the acquired frame.
The preexisting allocation lifetime is unchanged. Export-resolution-only
paths and WAT-native OLE continuations are outside this patch.

## Evidence and limits

`node test/test-js-com-callback-ownership.js`: 26 source cases and 10 mutation
negative controls. It executes the actual storage JS through its public COM
imports and interprets the three actual new WAT wrappers. The existing
sync/token primitives, guest allocator, memory translation and CPU runner are
explicit modeled boundaries. It does not compile or run a VM.

Cases cover all three paths, nested CreateInstance, sibling distinction, slice
identity, completed failure HRESULT, traps (including zero EIP), early output
publication, yield, exit, exhaustion of run rounds, token mismatch, abandoned
child, stale epoch/slot/thread, instance/memory replacement, acquisition failure
before guest writes, and checked leave before depth mutation.
Mutations remove acquisition/checks/restoration or truncate the token.
The original main storage bridge is also an expected-failure control.
Existing `test-storage-registry.js`, JS syntax, WAT parsing and diff checks pass.
The new test is automatically in the default unit tier.

The full source census (266 files, 399 entries) matches the three new wrappers
and changed host record. Its four inherited errors are the SHA/call-list fields
of `edit_stream_call` and `help_macro_call_routine`; a separate assignment owns
their reconciliation. Those records and the nonlocal API lock are untouched.
No `_setjmp`/`longjmp` API has been added or enabled.

Self-contained source replay, baseline, logs, census result, patch, hashes and
remote receipt: `scratch/runs/20261020-js-com-callback-owner/`.

**Remaining native qualification:** after independently reconciling the
inherited census blocker, build the combined tree through the unmodified gates.
Execute real x86 JS COM CreateInstance, AddRef/Release and legacy
DllGetClassObject with nested/sibling calls; verify argument order, stdcall
cleanup, exact restored registers/EIP/ESP/dispatcher state and returned HRESULT.
Exercise bounded slices, trap/yield/exit, early output publication, abandoned
nested frames, stale process and reused thread-slot ownership, token/capacity
failure and spill pin retention/release with actual primitives, checking no
parent mutation/resumption on rejection. Neither full VM nor Circus was run.
This source checkpoint does not qualify SEH, timer/wave/APC, other retained
carriers, saved jump buffers, dual-dispatch jumps or the whole nonlocal system.
