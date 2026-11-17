# Live LocalServer activation integration — 2026-11-15

Real LocalServer32 activation is implemented. A distinct client PE now resolves
and launches the registered command with `-Embedding`, waits for live class
publication, and invokes the real registered guest factory on its owning
continuation. Its returned interface uses the existing genuine OLEAUT32
IPSFactoryBuffer proxy/stub and authenticated byte channel. No command-line
OBJREF bootstrap, guest pointer transfer, canned factory or synthetic success
is used.

The unchanged genuine IKernel/ISetupMedia route now reaches actual launched
server registration and factory execution. It is **not qualified**: its real
ProxyStubClsid32 resolves to PSAutomation `{00020424-0000-0000-C000-000000000046}`,
but actual `CoGetClassObject` for that class returns `80040154`. A second
qualification gap is the Worker host's existing 60-second slice watchdog racing
the full activation registration deadline. No ordinary original, browser,
game input, NativeQuit or box was used.

## Implementation and ownership

`lib/com-owned-activation.js` owns opaque class registrations, launch claims,
activation tickets and normal-reference escrow in the authenticated authority.
Registrations retain CLSID, execution context, REGCLS visibility and independent
cookie, together with the exact authenticated connection/thread/generation and
source/module identity. Cross-process visibility requires LOCAL_SERVER.
SINGLEUSE hides on acceptance; MULTIPLEUSE remains visible. Revoke hides
immediately, but its actual retained guest reference survives accepted work.
Duplicate callers share a pending launch; a caller left waiting after a
SINGLEUSE publication receives a new launch claim. Command replacement,
retired owners and replayed tickets refuse reuse. Queued/executing cancellation,
late completion and packet retirement retain their separate ownership states.

`lib/com-owned-localserver.js` runs actual AddRef/Release, QI and CreateInstance
through `ComGuestContinuation`. Storage supplies only real registry metadata.
Ordinary public CreateProcessA launches the preserved command and closes its
thread handle; GetExitCodeProcess detects early exit. The existing ordinary
child path inherits authenticated runtime authority, exact Worker preloads,
read-only media context, explicit mounts and guarded state merge. Factory
execution runs on the registration's actual owner. Successful objects pass
through the existing standard marshaler's actual registered PSFactory,
CreateStub, export and normal lifetime; the client calls actual CreateProxy
and Connect through the existing unmarshal path.

Local same-owner activation invokes its retained object directly, without
borrowing another owner's pointer. Failed factory HRESULTs clear output and
remain failures. Nonzero successful HRESULTs remain intact. Ordinary failure
releases temporary references, allocations and launch handles. A trapped guest
child retains ownership for explicit retirement; cleanup does not invent a
returned child or restore an abandoned parent as success.

The WAT bridge parks the real stdcall frame for register/revoke/create/class
operations and resumes through the existing owned continuation mechanism.
The native client checks stack cleanup, EBX/ESI/EDI/EBP restoration, actual
factory rejection, deep BSTR, distinct process identity and returned interface
identity. Factory/object callbacks actually Sleep/yield. The server's zero-ref
assertions execute before its normal ExitProcess or checked Worker return.

The run records actual OS-child exit, both pipe EOFs, close and guarded merge,
including grandchildren. A guest ExitProcess message or signal request alone
is not a wait receipt. This optional observability does not alter child lifetime
or merge admission.

## Native results

Final shared and HEAD-plus-whole-owned phases use full locked builds and pinned
source/module identities. The authored PE server checks the quoted command's
suffix and appended `-Embedding`; publication waits at least 300ms by real
GetTickCount elapsed time. Worker servers read the main thread's actual command
line through shared guest memory, rather than rebuilding it from private WASM
globals. The client contains no active command-line OBJREF bootstrap.

| Actual case | Result |
| --- | --- |
| Main client / main server | PASS: actual factory failure then success, ABI, PID, deep BSTR, returned interface after original release, final refs zero |
| Worker client / main server | PASS: checked Worker completion and server final refs zero |
| Main client / Worker server | PASS: actual interface checks and checked server Worker completion/refcounts |
| Worker client / Worker server | PASS: both checked completions |
| Concurrent SINGLEUSE clients | PASS: distinct launched OS servers, both client checks and final refs zero |
| SINGLEUSE Worker client | PASS |
| Early exit, main and Worker | PASS: failure HRESULT and null output; server exits 26 |
| Unregistered main server | PASS: activation returns 80080005 at approximately 60s; server exits 27 after 65s |
| Full registration timeout on Worker | **FAIL/UNQUALIFIED**: host slice watchdog retires the caller before activation's result returns |
| Missing either exact preload | PASS: entry refuses before executing the client |

The first fast-Sleep timeout attempts were intermediate tests only: uncapped
runner Sleep advances on the batch clock even under `--real-ticks`. Final
unregistered fixtures wait against real GetTickCount elapsed time. The failed
Worker run is preserved, not reported as a pass because Node exited zero.
The host's `lib/guest-thread-host.js` is foreign-owned WIP and remains byte
exact. Its 60000ms slice request timeout is the actual next Worker lifecycle
contract: a legitimate pending COM wait needs a bounded, owner-preserving
scheduler handoff before that watchdog, without replay or abandoning its frame.
The activation deadline was not shortened to evade this failure.

## Genuine route and first actual failure

The main client uses the predecessor's unchanged kernelClientSource. Its
Worker variant wraps that same body in a real CreateThread; the outer fixture
wait is infinite and independently watchdog-bounded, avoiding the runner's
unrelated batch-clock finite thread-wait timeout. Both use the exact genuine
IKernel, OLEAUT32, stdole32.tlb, native common-controls input and inherited
read-only Disc1 D: context. Both exact Worker-safe preloads execute in every
participating process/Worker; missing either refuses. No registry seed or
public CoRegisterPSClsid fixture override enters this route.

Actual IKernel `-RegServer` writes its real class/interface metadata, exits
normally and is joined before guarded merge. Public CoCreateInstance then
resolves the real unquoted LocalServer32 command, launches IKernel with
`-Embedding`, observes actual SINGLEUSE registrations for the exact setup
kernel CLSID `{91814ec0-b5f0-11d2-80b9-00104b1f6cea}`, and schedules the genuine
factory for IID `{91814ebf-b5f0-11d2-80b9-00104b1f6cea}`. Owner-side marshaling
reaches actual CoGetPSClsid, which succeeds, followed by actual
CoGetClassObject for the registered PSAutomation class, which fails 80040154.
The real object/factory references are released and the server revokes its
classes and exits normally. The main report and Worker report both contain
`client.CoCreateInstance.ISetupMedia=80040154`, with mediaPresent zero.

The resulting registry has genuine Interface/ISetupMedia/ProxyStubClsid32
metadata but lacks PSAutomation/InprocServer32 class registration. This is
more specific than the former unimplemented activation boundary. The earlier
fresh-store genuine DllRegisterServer failure at RegOpenKeyA(HKCR,"Interface")
remains preserved historical evidence; it is not the first failure in this
run: actual IKernel registration creates that hierarchy and CoGetPSClsid
succeeds. No missing-key success was fabricated, per-game root seeded, or
registration forced to bypass the observed class lookup. The next genuine
contract is real system Automation proxy/stub registration through its actual
registrar, followed by unchanged-client requalification. Subsequent unsupported
custom IMarshal or arbitrary remote QI must remain explicit if encountered.

## Checks and recovery

The production activation tests pass 55 checks: 13 actual authority/storage
checks, 26 isolated activation state-machine checks and 16 real scheduler
adapter checks with isolated callback owners. Standard interface marshaling's
13 checks and the 164 guest COM callback checks pass, together with callback
frame/lifecycle, read-only child context, typelib child export, and current
controller/capture guard regression checks. These guard checks do not qualify
the currently failed browser/current-scene attestation or authorize an original.

Storage remains at the existing 78/79 EOF baseline, without waiver. Three old
fixture tests also fail unchanged on clean committed HEAD: explicit child-mount
closure extraction lacks pipeChildClosures, and the callback token/concurrency
mini-module extractors lack pending_seen. Their failures and clean-HEAD
comparisons are retained separately; they are not reported as passing tests.
All full build gates pass. Foreign 09a7op5/native graphics WIP stays unadopted
and byte exact.

Evidence is `scratch/runs/20261115-sims-live-localserver-activation-integration/`.
Its compact result, qualification records, selected logs, source/module pins,
actual waits, independent watchdog closure and PID/group absence form the run
record. Recovery uses exact Git SHAs plus binary patches, including new owned
files and relevant foreign uncommitted hunks; no source/media/WASM/frame/capture
bundle is made. Shared source visibility includes foreign hunks only for
read-only provenance; it does not claim file ownership or commit them.
Historical missing receipts remain UNKNOWN, not new work gates.

## Primary contracts

- [LocalServer32](https://learn.microsoft.com/en-us/windows/win32/com/localserver32): preserve the command and append ` -Embedding`; server registration is bounded.
- [CoRegisterClassObject](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-coregisterclassobject): actual retained class-object references, independent registration cookies and revoke.
- [REGCLS](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/ne-combaseapi-regcls): SINGLEUSE visibility, MULTIPLEUSE and MULTI_SEPARATE.
- [Interface key](https://learn.microsoft.com/en-us/windows/win32/com/interface-key) and [HKCR](https://learn.microsoft.com/en-us/windows/win32/sysinfo/hkey-classes-root-key): interface and class registration hierarchy.
