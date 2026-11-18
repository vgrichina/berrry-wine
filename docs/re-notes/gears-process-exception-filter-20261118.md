# VS2012 gears: process-wide exception filters

Evidence: `scratch/runs/20261118-gears-process-exception-filter/`.
The unchanged 16384-byte release executable is SHA256
`ef3de2e8bc52f1285fc603f374ac1f39781211590f2f38c1eb2c870418812240`.
The reporter's SHA remains unknown. The prior pointer/FP report describes the
confirmed `MSVCR110!__crtSetUnhandledExceptionFilter(402b57)` startup trap.

The [Microsoft setter contract](https://learn.microsoft.com/en-us/windows/win32/api/errhandlingapi/nf-errhandlingapi-setunhandledexceptionfilter)
requires replacement, previous-pointer return and NULL reset across all current
and future process threads. Delivery runs on the faulting thread, with real
exception pointers and a modifiable continuation context. A callback returning
SEARCH proceeds to default handling; EXECUTE returns to the associated handler;
CONTINUE_EXECUTION resumes from that context. The
[UnhandledExceptionFilter contract](https://learn.microsoft.com/en-us/windows/win32/api/errhandlingapi/nf-errhandlingapi-unhandledexceptionfilter)
describes the default no-debugger handling. This emulator retains its existing
host diagnostic/EXECUTE default policy; debugger integration and the Windows
Application Error dialog are not introduced by this repair.

Both Win32 and CRT setters now atomically exchange one allocator-declared DWORD
in process memory. Fresh processes receive fresh memory; a thread instance or
thread-slot replacement does not reset registration. The CRT wrapper is cdecl:
the unchanged caller pushes its one filter at 402b98, calls the import thunk at
402b9d, and pops the argument itself at 402ba2. Its callback at 402b57 returns
with `ret 4`. The wrapper shares the repaired process state rather than forwarding
to the previous instance-local implementation. No Wine execution/reference
behavior is used as evidence.

Public `UnhandledExceptionFilter` schedules a genuine guest stdcall callback.
Its CACA0043 continuation retains private frames partitioned by thread, with
root, parent and child identity, expected return ESP, mode, caller registers and
flags. Nested delivery owns independent frames. Validation precedes restoration
and frame retirement. The bounded capacity is eight concurrent filter callbacks
per guest thread; overflow fails explicitly. The small private region fits the
existing fixed memory map without changing pinned layouts or adding a host ABI.

Exhausted CPU and software SEH also offer the installed filter. CPU faults use
the existing x86 CONTEXT layout; software RaiseException now retains the
original context alongside its complete exception record and parameters, even
after an SEH handler declines it. CONTINUE_EXECUTION applies the supplied
context; EXECUTE/default terminates an exhausted chain with its exception code.
Continuing a noncontinuable exception reports C0000025; an invalid disposition
reports C0000026. Deliberate unsupported-API traps still bypass guest exception
delivery and remain explicit fatal errors.

The new callback producers are recorded in a feature-owned census review.
Feature addition support preserves the same duplicate, lifetime, hash and shape
checks without adopting foreign changes to the base census. The silent-handler
ratchet decreases 232 to 231 because the existing setter now performs an atomic
process-state mutation. An existing modeled SEH test failed on unchanged HEAD
at its unmodeled pending-gap primitive, then lacked the existing REP fault intent
global. Its model now supplies those existing primitives; its 84 cases and 40
rejecting mutations pass. No production synchronous-fault behavior was changed.

Authored real PE tests pass native and compatibility execution: both setters,
replacement/reset, cdecl/stdcall ESP, all caller GPRs, nested callbacks, actual
software exception parameters, CPU fault context/register edits, supported
dispositions, invalid disposition, noncontinuable faults and independent process
lifetimes. Private-continuation negatives cover expected ESP, mode, parent,
child, root, stale return, capacity and nested LIFO restoration. The old module
traps on the CRT wrapper; a separate Win32-only old control fails actual filter
delivery. Native OS threads and ordinary browser Workers cover an existing
thread, a future thread, registration from a worker observed by main, callback
thread identity, and cross-thread software/CPU fault recovery. Browser SEARCH
and EXECUTE controls terminate with the original software exception code.
An unsupported CRT API remains a trap with a filter installed. Existing SEH,
CRT initialization/exit, pointer encoding and floating-control regressions pass.

Published runtime commit `d9209a25f`, immediately pulled and pushed main as
`476e9fe21`; receipts are `code-pull.log` and `code-push.log`. Both locked
full builds (`build-fourth.log`, `build-coherent.log`) pass. Concurrent shared
builds produced distinct modules; the evidence records each actual hash rather
than treating them as interchangeable. The sealed final module used by the
last native/compatibility control, ordinary Worker control and affected upload is
`3f27388d07366d42145284cc74759d9785d4011b1cc7b9d537ae8efaa39df2b9`
(2411636 bytes). Its manifest verifies all 353 source files before launch;
all 120 affected-program source/module response readbacks match local files.
Earlier actual cross-thread fault controls use the separately retained/tested
`379ac211` and `fba9ca5e` modules. The unsupported-API browser control actually
used `2c353f17`; it remains explicit failure, with no claim that its module
matches the final upload. Old authored controls intentionally serve the prior
module and matching prior layout; their four current-file readback differences
are those pinned module/layout responses.

Before: an ordinary file upload of the unchanged EXE with default slice 100000
and Workers enabled reaches the confirmed CRT registration trap at 4030c8 on
module `12520027984b3003006746db7971302b06b3ad999e946c38d428d024f060ee63`.
After: the same ordinary upload, with no module override, guest patch or app
configuration change, passes CRT startup. Logs report CreateWindow("glxgears")
and ShowWindow(hwnd=10001, cmd=5), then an explicit unsupported-instruction trap
at EIP 401eca (previous block 401ec0). The actual instruction starts at 401ec9:
`66 0F 6E CA`, `MOVD xmm1, edx`; the decoder's unknown-0F trap records the
address after the mandatory 66 prefix. ECX and EDX are both 300, consistent with
the unchanged reshape routine. Its following instructions include another MOVD,
CVTDQ2PS and DIVSS. Source inspection confirms prefixed MMX-family opcodes fall
through rather than being misexecuted as MMX. This is a concrete SSE2 decoder
blocker, beyond the repaired exception-filter/CRT lifecycle. No bypass was added
and unsupported traps were not delivered as handled exceptions.

Both retained whole screenshots were personally reviewed. The after screenshot
shows the upload icon and diagnostic desktop; no game frame or rotating gears
are visible. Window creation/show logs are progress, not proof of a rendered
window. Selected captures are `before/crt-registration-trap.png` and
`affected-after/sse-movd-trap.png`. No animation or ordinary guest exit is claimed.
The trapped scopes closed without a Quit input; browser cleanup is distinct
from guest ExitProcess. All thirteen browser/native/watchdog scopes completed
actual waits with both stdout/stderr EOF, no leaked descendants and no supervisor
termination. Each had a finite independent watchdog and a predeclared 180-second
Quit reserve. No endpoint was revisited after closure. Box ID/state/expiry/stop
receipt: null / NOT_CREATED / null / null. No agents, workers or boxes were
created; browser guest Workers are the explicitly required normal runtime path.

Recovery is described in `RECOVERY.md`: Git plus explicit owned and relevant
shared-WIP patches, unique retained modules, authored small PE fixtures, exact
EXE release URL/hash and source manifests. Run artifacts remain ignored; no
source-tree archives, media copies, frame series or capture bundles are retained.
`result.json` is written last after publication, artifact verification and
ownership release preparation.
