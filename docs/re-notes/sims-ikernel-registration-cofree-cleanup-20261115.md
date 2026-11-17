# Sims IKernel registration and COM library cleanup — 2026-11-15

Evidence: `scratch/runs/20261115-sims-ikernel-registration-cofree-cleanup/`.
The necessary bootstrap repair corrects external-process waiting.
CoFreeAllLibraries is a separate real loader-lifetime implementation.
Neither result establishes that The Sims has installed.

## Retained boundary and demonstrated prerequisite

The inherited-D predecessor feature `8f2c2cb4f98473f86797e82fd0c34ff76b77e21c`
and report `3761f06c8986025dd84979e0e938bff1993e6c3b` established
generated child success, but their exact Nova original still reported
80040154. Original child registration, guest exit and completed export/merge
were not observed. The child Node exit hook's zero is a host lifecycle result,
not a guest success. Its missing outer-launcher actual wait stays permanently
UNKNOWN. No old request, input, replay, rebind or original retry was made.

The new authored parent launches the existing genuine 614532-byte IKernel
with -RegServer, NULL child cwd and inherited real D:\Setup. It uses Setup's
actual 10000 ms wait, real common controls/stdole32 data and existing guarded
readonly context/export. It imports no registry or substituted engine.

Baseline: the parent returns WAIT_TIMEOUT and guest exit 43 after 0.441 seconds.
The child subsequently registers, exits zero and completes the guarded
five-file/298-key merge. The scheduler incorrectly assumed that no runnable
local guest thread meant nothing could signal a finite wait. Native children
run independently on the host event loop.

Native process/thread handles now use a monotonic external deadline and yield
the host loop between probes. The idle-main shortcut and guest/service clock
acceleration cannot expire these waits. Guest clocks/defaults are unchanged.
Multiple-object and Worker waits recognize the same external handles. A native
fixture covers zero polling, a finite multiple-object timeout, later signaling
and the actual child exit code.

The repaired genuine child exits zero and merges before the parent's successful
wait returns. The parent then reads Setup class
{91814EC0-B5F0-11D2-80B9-00104B1F6CEA}\LocalServer32 pointing to the real IKernel,
and the engine's TreatAs mapping {8C3C1B17-E59D-11D2-B40B-00A024B9DDDD} to
{22D84EC7-E201-4432-B3ED-A9DCA3604594}. These are newly observed registrations.
Early fixture assertions confused these two classes, then compared case
sensitively; their failures remain retained and are not runtime repairs.
The final shared probe checks both registrations and both guests exit zero
in 3.468 seconds. HEAD plus whole owned paths also passes both exact queries,
with both guests zero and the merge preceding the parent continuation
(2.648 seconds in the native harness).

Registration remains distinct from activation. The current storage COM bridge
searches InprocServer32; LocalServer32 activation is a separate limitation.
This change manufactures no class factory, cross-process object, DLL load,
registration entry or successful HRESULT.

## Actual library lifetime

Successful legacy bAutoFree CoLoadLibrary loads record automatic references
as a subset of ordinary loader roots under the loader lock. Failed loads
record nothing. Pending intent is captured once before nested initializers.
A contended entry preserves its thunk and arguments; accepted delegation alone
consumes the two-argument, 12-byte stdcall frame.

CoFreeAllLibraries consumes the list under the loader lock before callbacks.
Ordinary LoadLibrary and bAutoFree false references survive. Unreachable images
follow the existing reverse attach-order DLL_PROCESS_DETACH, dependency/pin,
reservation-token and generation-retirement path. Repeated/nested cleanup
cannot consume the old list twice. Retirement clears the slot's bookkeeping.
Explicit FreeLibrary prefers nonautomatic roots and removes automatic ownership
when only automatic roots remain. Builtin references retire while static code
stays resident. CoFreeLibrary uses ordinary explicit release with a void ABI.
Sync, async and scoped services share the captured operation.

This is the requested legacy automatic-reference compatibility model.
Microsoft's current [CoLoadLibrary documentation](https://learn.microsoft.com/en-us/windows/win32/api/objbase/nf-objbase-coloadlibrary)
says modern Win32 ignores bAutoFree; the legacy list/release contracts appear in
[CoFreeAllLibraries](https://learn.microsoft.com/en-us/windows/win32/api/objbase/nf-objbase-cofreealllibraries)
and [CoFreeLibrary](https://learn.microsoft.com/en-us/windows/win32/api/objbase/nf-objbase-cofreelibrary).
Those descriptions do not justify unloading unrelated ordinary references.
Existing apartment balance and CoFreeUnusedLibraries are outside this explicit
cleanup change. There is no silent success stub.

Native authored PE/DLL tests check public Ping calls, actual detach, surviving
ordinary/manual references, repeated loads, reload, missing loads, builtin
release and nested cleanup during detach. Assembly checks actual ESP and
callee-saved EBX/ESI/EDI/EBP; guest checks cover last-error sentinels. Main and
actual production guest Worker pass. Another real native instance owns the
callback gate in the retry test: two parked entries preserve the frame, then
accepted loading acquires one real root, detaches and retires.

The selected full scenes error-close-main/result-error-close.png and
error-close-head/result-error-close.png were personally reviewed. Each new
authored native instance received one titlebar X gesture lasting 120 ms with
independent physical-UP ACK.
The guest verified real DLL detach after closing and exited zero; native actual
wait/both EOFs also report zero. This proves error-close cleanup, not installation
or native Quit. An earlier fixture had no main HWND and received zero inputs;
its host stop is separate. Flat image display items were not used for input;
the complete duplicate item was reviewed before the admitted gesture.

## Qualification checkpoint

Readonly tests reject writable, replaced, revoked, foreign and malformed
namespaces. Seventeen export adversaries are rejected without touching borrowed
source. Exact source/map preloads reach both actual authority Workers and join
them; either missing preload is refused. Input policy/transport controls pass.
The public loader/readonly/guarded-merge/IPC observer neither forces outcomes
nor keeps an unfinished await alive; its own pending/resolution/rejection/throw
tests pass.

Shared and HEAD plus whole owned paths full builds/native qualification pass.
Real PE unload/rollback, terminal detach, Worker callback serialization, races
and import graphs pass. Two additional suites fail identically on HEAD with
no owned changes: browser Worker VM fixture misses CommandWriterHandoff, and
scoped-loader retirement times out at its 25 ms test limit after both owned
callback-loader groups pass. These failures are retained, not reported as passes.
The shared-tree scoped-loader suite passes all retirement, scheduler-drop,
termination-retry and bootstrap-ownership checks.
Feature published on main as `7c8ca48353b0917b8fdf73a491b0f999d098dd22`.
All fourteen
foreign WIP pins are unchanged. Git SHA and relevant binary diffs are the source
archive; this run archives no source tree, real media or WASM.

## One qualified ordinary original

After publication, one unchanged exact Nova Disc1 D:\Setup\Setup.exe ran with
the retained real partial overlay, existing genuine DLLs/TLB, exactly two
Worker-safe source/map preloads, published committed source, the qualified HEAD
module, real ticks, native 900-second/independent 920-second deadlines and the
180-second Quit reserve. All 3177 launch pins matched immediately beforehand.
Parent and child consumed source and mapped-host hashes were verified afterward.

This original newly demonstrates genuine registration: CreateProcessA and
Setup's 10000 ms wait precede the real child's CoTreatAsClass, guest exit zero
and guarded merge of 298 registry/INI keys. No child files changed because the
retained overlay already had the engine. Only after that merge does the parent
call COM activation. The host bridge returns 80040154, followed by the visible
"The InstallShield Engine (iKernel.exe) could not be launched" error. The current
bridge's InprocServer32-only resolver remains the next activation boundary;
LocalServer32 registration is not a cross-process class factory or object.

The complete current error scene was personally reviewed. One fresh titlebar X
gesture at 570,250 lasted 120 ms; independent physical UP was acknowledged.
The parent then exits zero, native wait is zero with both EOFs, and watchdog,
supervisor and this run's own outer-launcher actual waits are retained.
The former unimplemented-CoFreeAllLibraries exit-one failure does not recur.
No installation success, native Cancel or native Quit is claimed; host stop
was unnecessary. The final saved preparing-wizard image is stale post-exit UI,
not a live or installed state.

The native overlay flush reports four records. Post-run comparison of all
3177 pins finds only installed-overlay/index.json changed; source, real media,
engine blobs and native modules match. Guest-created overlay metadata is kept.
The single original is closed, with no later requests/input, rebind, replay or
second original. All historical UNKNOWN receipts remain closed and unchanged.
No workers or boxes were created; box ID null, state NOT_CREATED, expiry null,
stop receipt NOT_APPLICABLE. Closure and explicit release are recorded in the
run's result.json/runtime-release.json after final personal verification.
