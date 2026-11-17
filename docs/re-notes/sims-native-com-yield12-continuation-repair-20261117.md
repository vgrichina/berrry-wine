# Sims native COM continuation, 2026-11-17

Evidence: `scratch/runs/20261117-sims-native-com-yield12-continuation-repair/result.json`.

The previous normal original registered 293 keys, completed its unchanged
10,000 ms wait in 1,744 ms, and activated the genuine embedding server. Its
Automation stub then encountered native yield 12. The owner is
ComInterfaceRuntime's ComGuestContinuation, reached through
ComOwnedProxyHost.invokeStub and NativeAutomation.invokeStub. This failure is
separate from the authored non-Automation provider's missing proxy support.

Yield 12 represents the owning native thread's pending VFS ReadFile. The COM
continuation now awaits that exact pending provider read, checks the same native
owner/token/thread/frame again, clears the suspended yield and lets native code
retry ReadFile. Provider faults retain their native error and HRESULT. A missing
pending read is rejected. No scheduler reference, timeout, registry seed or
Microsoft implementation is changed.

Every continuation exits through token-checked restoration, including exceptions
and host retirement. Restoration includes registers, native/private instruction
positions, thunk, stack position, FS/SEH, suspended yield and lazy arithmetic
flags. The two new flag exports require the exact native callback token. A
replacement epoch or instance never receives an old saved frame. Retirement
fences new method calls while allowing validated cleanup of the original owner's
allocations, RPC buffers, marshaled packets and real interface references.
Executing cancellation retains its server pin until actual unwind; authenticated
stub failure releases it with RPC disconnection and no invented native result.

The focused fixture enters the actual native Automation proxy/stub path, invokes
a real lazy ReadFile, and checks asynchronous completion, a nested native
callback, real server HRESULT, provider error/cancellation, rejected I/O service,
executing RPC cancellation, disconnect, owner retirement with queued work,
native traps, BSTR/interface outputs and outputs written before a trap. It checks
restored CPU/caller stack, allocation cleanup, actual reference counts and empty
export/request tables. Native stale-token and replacement-epoch controls refuse
mutation. Existing owner-boundary tests, focused registration/marshaling guards,
and the canonical locked build are recorded in the result. Unchanged native
parser/stdole/BW2 and input-guard evidence is reused by exact hash rather than
blanket replay.

The one authorized normal original and its final limits are recorded in
result.json. Full T-db74d863 still requires actual Sims and complete BW2/IS11
setup; this continuation proof alone does not close it.

Unwind now restores registers, caller stack position, public/private instruction
pointers, thunk, steps, handler state, suspended yield, FS/SEH and lazy flags in
a finally block. Two token-checked native exports preserve the six lazy flag
fields. Exact instance/memory/native epoch/root and child-token checks remain
mandatory; replaced native owners receive no saved state. Host retirement
fences new calls while still allowing the original owner to release existing
buffers, packets and interface refs. Caller cancellation keeps an executing
pin until the real exporter unwinds; authenticated exporter failure settles it
as RPC disconnection, with no fabricated outputs or method success.

Fourteen actual-native cases exercise the same runtime/Automation/proxy/stub
path: asynchronous ReadFile, nested native callback, server HRESULT, provider
error and cancellation, rejected read service, executing RPC cancellation,
disconnect, retirement with another queued call, native trap, BSTR/interface
outputs after reads and BSTR/interface outputs before traps. Each verifies the
saved CPU state and temporary allocation cleanup. Final server refs are one,
with zero exported interfaces, native objects or requests. Stale native flag
tokens are refused; a replaced native epoch is untouched. Existing native
owner boundaries, four focused guard/marshaling suites and the final canonical
locked build pass. A preceding final-build harness expired during compilation;
its actual failure is retained and superseded by the successful 600-second
outer build deadline. No guest or input timeout changed. Existing typelib,
stdole, BW2 parser and input-guard evidence is reused only after exact hash
readback; the runtime module itself changes for the new native flag exports.

## Published repair and single normal original

Repair `783f180172e99da87c0c69de079d942ecee57870` is published on main.
The one authorized original used compatibility module SHA-256
`915c2c7ed533a7423968daca502e0bdc83ca584aa6a6655bb74cde61016505f1`,
normal real ticks and current published scene code. Provider omission applies
only inside execution; host provider and media hashes remain unchanged.
The independent deadline watchdog was armed before native launch. Exact native
PID 1533428 exclusively owned the control listener before capture.

The genuine registrar 1533629 exited 0 and published 293 keys before the
parent's unchanged 10,000 ms wait completed successfully (3,751 ms between
initial wait observation and completion). Genuine embedding PID 1533709
activated successfully. It executed real nested ReadFile operations on
`D:\Setup\data1.hdr` and `layout.bin`; the previous unsupported-yield-12
exception is absent. It then trapped in the unimplemented API fallback:
`OLEAUT32.DLL#162` via IAT `0x46c2b0`, EIP `0x00403d7e`. Read-only inspection
of the pinned genuine DLL identifies ordinal 162 as LoadRegTypeLib. Native
LoadRegTypeLib exists, but this original's ordinal import is not bound. The
protected compatibility closure has exactly 16,839 functions, matching the
actual module's code count; its function 4389 is handle_fallback. A legacy
raw-source index walk is retained as rejected diagnostic evidence because it
does not include generated wrappers/trampolines and names the wrong function.

The first whole image showed an untitled teal backdrop and installer progress.
Its bind helper refused locally before any bind request because no modal was
present. A new full image showed the Sims backdrop and support-file error
`0x80010108`; this scene was reviewed and bound successfully. The following
full image was entirely teal, with no visible Quit target despite retained
native modal metadata. It was marked terminal UNKNOWN; no later HTTP requests
or physical inputs occurred. No installation or native Quit is claimed.

Host cancellation left the trapped embedding child live. Identity-checked
SIGKILL retired only that child; its parent then recorded actual close, both
EOFs and refused the absent completion marker rather than merging failed
state. Parent wait is actual exit 0, with both EOFs. Registrar, embedding,
control helpers, watchdog, supervisor and outer actual waits are retained.
The embedding main-thread exit-only provider audit is missing after SIGKILL;
its separate worker audit does not substitute for that missing audit. This is
explicitly a forced cleanup, not actual guest completion.

Next is binding the original's OLEAUT32 ordinal 162 to the existing genuine
native LoadRegTypeLib implementation with focused ordinal-path proof. No
second original was launched. Full T-db74d863, actual Sims installation and
full BW2/IS11 original setup remain open. No boxes were created: ID/expiry null,
state NOT_CREATED, stop NOT_APPLICABLE. No workers, source/media archives,
media copies or deployment were made; foreign WIP and cachelinks are preserved.
