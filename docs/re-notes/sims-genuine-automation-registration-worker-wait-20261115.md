# Genuine Automation registration and Worker activation wait — 2026-11-15

Genuine registration and the full Worker activation deadline now pass. The
unchanged genuine client obtains ISetupMedia, then stops at unsupported remote
QueryInterface with `80004001`. Full unchanged-client qualification remains
open. No original installer or browser input was attempted; native installer
Cancel/Quit is unobserved.

## Implementation

The registry adapter now exposes a generic empty `HKCR\Interface` system
namespace, preserves valid predefined roots and empty-open handle identity,
and resolves machine Classes aliases and the merged user Classes view. It
retains independent missing-key errors and routes writes without copying
machine values into user keys. Public enumeration, query-info, snapshots and
COM metadata use the same view. This implements the documented merged Classes
rules; it does not claim a complete Windows security or version model.

Legacy `RegOpenKeyA/W` preserve the original handle for empty subkeys; extended
opens preserve predefined roots but allocate an independent handle for an
allocated input key. A synchronous legacy wrapper handles this distinction
without changing the foreign extended-W handler. `RegSetValueA/W` closes only
a separately opened or created handle. The intermediate candidate had applied
legacy identity in the shared backend, so its first empty write closed the
caller key and the following InprocServer32 write returned error 6. That
pre-publication failure is retained; it is not claimed as an unchanged-main
bug. An independent native A/W-versus-Ex lifetime control covers the corrected
separation.

Worker pending LocalServer activation advances one retained iterator at an
ordinary scheduler boundary. The ticket, launch handles, original frame and
full-width invocation token stay attached to the original process/thread and
generation. Before and after each awaited advance, the runtime validates the
owner, registers, arguments, GUID contents, stack, SEH, thunk, handler and
yield state. Invalid or retired work is abandoned without restoring or
replaying its frame. Pre-slice drains validate the same parked owner. Main and
nested callbacks retain their whole-operation path. Neither the 60000ms host
watchdog nor the real COM registration deadline changes. Foreign
`lib/guest-thread-host.js` is preserved and is not adopted by this change.

No game registrations, PS fixture override, substitute factory, alternate DLL,
local-pointer alias or forced initializer is used in the genuine route.
The genuine DLL writes its registrations through ordinary registry APIs.

## Before and after

Source baseline after the coordinator remote merge:
`087a94a0405bb30837a0adf7d8f2c8ec923a18bf`. Earlier evidence against
`dd724f85ba9e83d59145d8e15af796dfae8d7e0e` remains separately named.

Fresh current unchanged IKernel activation reaches actual `-RegServer`, joined
exit and guarded merge (298 keys, three changed files in this mounted fixture),
then unquoted `-Embedding`, live SINGLEUSE publication and the genuine factory.
`CoGetPSClsid` returns S_OK. The subsequent PSAutomation class lookup returns
`80040154`. The previous run's five-file merge is a different mounted fixture;
it is not substituted for this observation.

Fresh-store genuine registrar main and Worker baselines separately return
`80070002` opening Interface. After fixing the root, the intermediate native
registrar returns `80070006` at RegSetValueA as described above. With both
fixes, actual main and Worker `DllRegisterServer` return S_OK and write
`CLSID\{00020424-0000-0000-C000-000000000046}\InprocServer32=oleaut32.dll`.
Actual export RVAs are verified: DllRegisterServer `3d18c`, DllGetClassObject
`464b`. Genuine DllGetClassObject obtains IPSFactoryBuffer, its IUnknown QI
succeeds, and public PSAutomation lookup succeeds. IClassFactory QI on the PS
factory returns `80004002`; an unrelated missing class remains `80040154`.

All eight isolated public native registry controls pass, including empty-root
identity, machine/user views, predefined-root writes, absent-key errors and
repeated empty-subkey writes without losing the caller handle. Actual A/W-versus-Ex
handle lifetime also passes in shared and HEAD-plus-owned builds. Fifteen actual
storage-adapter controls and 31 actual runtime-driver ownership controls pass.
The 46 report-oracle controls are synthetic checks, not native qualification.

Current unchanged main deadline returns `80080005` after 60020 guest ms with
null output and completion. Current unchanged Worker caller is retired by
`worker 1 did not answer slice in 60000ms` before returning a result. The
independent unregistered child exiting after about 65 real seconds is not
caller completion or native installer Quit. The final fixed shared main returns
normally after 60020 guest ms (68755 ms supervised wall time); actual Worker
returns normally after 60582 guest ms (70707 ms supervised wall time). Both
return `80080005`, null output and the completion marker; Worker thread exit
is zero. Actual wait and both EOFs are verified. The final HEAD-plus-owned
repetition returns at 60020 ms main and 60660 ms Worker (69216/71288 ms
supervised wall time), with the same normal failure and exit.
The deadline C/PE inputs and 60000ms host watchdog are unchanged; only the
owned scheduling adapter changes how pending work returns to the host.

After genuine system registration, both main and Worker unchanged clients
report `CoCreateInstance.ISetupMedia=00000000` and `mediaPresent=1`. The next
public provider-IID QueryInterface reports `80004001` with null output; the
service call is therefore not reached. The controlling unknown supports
already imported interfaces but explicitly returns E_NOTIMPL for a new remote
IID (`lib/com-owned-proxy.js`). This exact first failure is retained rather
than aliased to a local pointer or misreported as E_NOINTERFACE. The unchanged
main client exits 111; its unchanged Worker wrapper exits 228. Bootstrap
parent exit is not treated as full client success.

Known failures remain unwaived: storage checks 78/79 at EOF, and the old
extracted child-mount, callback-concurrency and callback-token fixture failures.
Raw shared and HEAD-plus-owned focused results retain those same four failing
commands rather than reporting an all-pass suite. New controls pass in both
views, as do 55 activation, 13 marshaler and 164 guest COM checks, callback-frame
ABI/lifecycle checks, paired input/capture controls and read-only media/merge
guards. Both actual missing-preload runs refuse before guest entry.

Four actual main/Worker channel combinations pass in each source view. The
HEAD repetition also passes delayed registration, single use, concurrent
single-use callers and early exit with normal failure HRESULTs. Successful
authored servers check final references at zero; Worker wrappers verify their
unchanged bodies completed. These authored regressions do not qualify the
genuine follow-on service call. The final shared module is rebuilt before
publication; no foreign runtime WIP is included in the commit.

A final real HEAD deadline run exposed an independent launch-claim race:
its caller returned `80080005` after 60086 guest ms, but a poll just across
60000ms discarded the expired launch and launched a second unregistered
server. The second child was still running when the independent 105-second
run watchdog sent TERM/KILL. That run is a failure, not a normal closure or
native installer Quit, and all actual waits/EOFs and the watchdog receipt are
retained as `final-v4-head-deadline-main`.

Launch-claim admission now observes the clock once, checks the activation's
own deadline, and uses the same observation for existing-claim expiry. An
expired job returns its legal failure instead of obtaining another launch.
Three state controls reproduce the boundary failure against unchanged HEAD
and pass with the fix, while preserving replacement for a distinct new legal
activation. These clock-controlled state tests are not real-time qualification.
Final real native shared/HEAD repetitions after this correction each launch
exactly one server and complete with normal process closure. No activation or
run timeout has been increased.

## Genuine inputs and evidence

Genuine OLEAUT32 is 598288 bytes, SHA-256
`baeb2f7c1b8be56738d34e1d1ddf8e0eebd3a633215dc1575e14656be38b939d`.
The route also mounts exact IKernel, stdole32, genuine COMCTL32 and COMMCTRL,
with read-only Disc1 and exactly the two pinned Worker preloads. Missing either
preload is a refusal. The follow-on public-QI/service client PE is unchanged
from run `20261115-sims-live-localserver-activation-integration`.

Evidence lives in ignored
`scratch/runs/20261115-sims-genuine-automation-registration-worker-wait/`.
Inputs and media are referenced by path and SHA; Git plus relevant binary
patches records source. No source/media/WASM/capture bundle is archived.
Every new native process has an independently armed deadline watchdog and
actual native, watchdog and supervisor-child waits with both EOFs. No box or
new worker is created.

Predecessor Sims, GTA2 and GL releases were personally hash-reviewed with their
named actual waits and current PID/group absence checks. Root merge release
was similarly reviewed. Its five missing historical outer-wait receipts stay
UNKNOWN and are not new-work gates; absence is never claimed as actual wait.
Root merge changed the foreign host baseline to SHA-256
`364bbcd12d1f55080aa9a5ae1d33545acc4e24a03574413954e36821aec1862b`;
that exact WIP remains foreign. GTA2's final native input/capture guard is
partial and GL startup is UNKNOWN, so neither authorizes a Sims original run.

## Primary contracts

- [HKEY_CLASSES_ROOT](https://learn.microsoft.com/en-us/windows/win32/sysinfo/hkey-classes-root-key)
- [Merged Classes view](https://learn.microsoft.com/en-us/windows/win32/sysinfo/merged-view-of-hkey-classes-root)
- [RegOpenKeyA](https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regopenkeya)
- [RegOpenKeyExA](https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regopenkeyexa)
- [RegSetValueA](https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regsetvaluea)
- [DllRegisterServer](https://learn.microsoft.com/en-us/windows/win32/api/olectl/nf-olectl-dllregisterserver)
- [Interface key](https://learn.microsoft.com/en-us/windows/win32/com/interface-key)

The reviewed modern merged-view rules include Windows 2000/XP behavior; these
are not a claim of complete Win98 registry version equivalence.
