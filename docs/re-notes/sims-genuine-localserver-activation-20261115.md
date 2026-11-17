# Sims LocalServer32 prerequisite repair — 2026-11-15

Evidence: `scratch/runs/20261115-sims-genuine-localserver-activation/result.json`.
The new original is withheld. Genuine cross-process activation and the unchanged
IKernel ISetupMedia client interface have not qualified. No installation,
installer Cancel, installer Quit, browser action or new original was attempted.
The previous original remains permanently closed.

## Reproduced boundary

Published `7c8ca48353b0917b8fdf73a491b0f999d098dd22` / report
`3a4416c6315fc0ef1e8a28d62bc193098bb4611b` establish real IKernel registration
and a guarded 298-key child merge before parent activation. The retained log
then records `com_create_instance(..., 0x40000004, ...) => 0x80040154`.
Public context 4 is CLSCTX_LOCAL_SERVER. The high bit requests caller-side
resolution; this failure occurs after registration. The reviewed old error
close returned parent/native zero; it proves neither installation nor Quit.

The unchanged Setup PE is 168448 bytes, SHA-256
`fe95a9fc8b2cdb5add76fbd326b1a11801eaa43c7d908f20cbdf413fd4d8dfde`.
VA 0x00409460/raw 0x7c60 is IID ISetupMedia
`{91814EBF-B5F0-11D2-80B9-00104B1F6CEA}`; VA 0x004095a0/raw 0x7da0 is
Setup Kernel CLSID `{91814EC0-B5F0-11D2-80B9-00104B1F6CEA}`. These match
the exact failed activation's argument addresses.

Retained real registration `bootstrap-shared.registry.json`, SHA-256
`cd63ca320ba3c56af023c7a4efc719628b8daf41376e79650170bd9683636615`,
names SetupKernelTypeLib `{91814eb1-b5f0-11d2-80b9-00104b1f6cea}`, version
1.0, and the genuine installed IKernel executable. ISetupMedia uses registered
ProxyStubClsid32 `{00020424-0000-0000-C000-000000000046}`. Registration
metadata is not a factory, an object or successful activation.

## Necessary generic repairs

Class registration now filters execution context, keeps duplicate cookies
independent, exposes older live registrations after revocation, and removes
SINGLEUSE registrations from public lookup while retaining their cookie and
registration reference until revoke. MULTIPLEUSE has its documented in-process
visibility. Invalid registration arguments return E_INVALIDARG with a zero
cookie. Two existing fixtures now use valid INPROC/MULTIPLEUSE registrations.

Public CoGetClassObject now runs the registered object's actual QueryInterface
on the calling guest's continuation. Its returned interface owns a real
reference; unsupported IID returns the real failure and NULL output. It uses
the existing COM activation frame and return thunks. The clean TreatAs wrapper
contains this change; foreign `09a7-handlers-dispatch.wat` remains untouched.
LOCAL_SERVER-only lookup cannot fall through to InprocServer32. There is no
fake factory, canned successful HRESULT or cross-memory guest pointer.

An authored parent starting unchanged IKernel with `-Embedding` in inherited
D:\Setup exposed a separate retirement defect: TerminateProcess immediately
signaled the guest process handle, while the native child could defer SIGTERM
because its synchronous guest loop never serviced the event loop. Signal or
deadline shutdown also retained the child's IPC connection. The baseline
needed watchdog KILL and its child wait remains permanently UNKNOWN; both
recorded native PIDs were subsequently personally checked absent.

The generic CLI repair keeps termination pending until actual native child
`close` (OS exit and pipe closure), preserves the requested termination code,
and performs the existing guarded state merge before signaling the guest
handle. Spawned children periodically service the host event loop, and normal
cleanup disconnects their IPC even without guest ExitProcess. Parent desktop
retirement awaits the child-close promises. No guest clock/deadline is edited.

## Native evidence and limits

Authored PE registration clients exercise actual factories and objects,
QueryInterface refusal, duplicate cookies/revocation, context filtering,
SINGLEUSE, MULTIPLEUSE and MULTI_SEPARATE, actual reference counts and final
retirement. Checked API wrappers verify ESP and EBX/ESI/EDI/EBP; existing
native callback suites check all GPRs, EIP, decoded IP, SEH, nesting and
process/thread/generation replacement refusal. Exact completed runs and module
hashes are recorded in result.json; a host exit alone is not a guest assertion.

A genuine OLEAUT32 probe executes LoadTypeLib on unchanged IKernel, reads
ISetupMedia's public TYPEATTR/FUNCDESC, registers that actual loaded type
library, obtains the actual IPSFactoryBuffer from OLEAUT32 DllGetClassObject,
and successfully calls CreateProxy. Its only selected guest save is
`proxy-factory/native-saves/localserver-typeinfo.txt` (1033 bytes). ISetupMedia
is TKIND_INTERFACE, two methods at vtable offsets 12 and 16, returning HRESULT;
parameters include BSTR and interface-pointer outputs. No method result is
fabricated. Proxy creation does not qualify channel transport or a server call.

The repaired inherited-D startup probe observes unchanged IKernel execute
**two real LOCAL_SERVER/SINGLEUSE CoRegisterClassObject calls**. The authored
parent waits five seconds, requests TerminateProcess(99), waits for actual
native retirement, verifies code 99 and exits zero. Root and child actual waits
and both pipe EOFs are sealed. This is forced process retirement, not IKernel
Quit, client-interface qualification or installation. No overlay or original
was used for that probe. Required Worker-safe source and host-map preloads
remain active; the startup probe adds only a passive fork/exit/EOF observer.

## Exact remaining prerequisite

`lib/storage.js` still has no LocalServer32 launch resolver or live cross-process
class publication. Its class table belongs to one process. Native CreateProcess
and its completion/registry merge do not provide a COM activation channel.
The authored separate-server activation client still fails with
REGDB_E_CLASSNOTREG and never launches its registered LocalServer32 executable.
The current repair must not be described as implemented local-server COM.

The next implementation must resolve/launch the documented LocalServer32
command with ` -Embedding`, wait for actual registration, and forward genuine
factory and object calls over an owned, generation-checked process channel.
For actual ISetupMedia it must connect the real registered OLEAUT32 proxy/stub
through an implemented IRpcChannelBuffer and invoke the actual server interface
with marshaled bytes and interface lifetime. Returning a child pointer is
invalid. CoMarshalInterThreadInterfaceInStream only transfers pointers within
shared memory; it cannot supply that transport. The current bridge has no
qualified channel, stub invocation or object identity/lifetime protocol.

Consequently delayed cross-process registration, failed-server/timeout
activation, remote single/multiple-use semantics, deep BSTR/interface copying,
and remote source/process/thread/generation replacement refusal are unqualified.
Their authored candidates are reproducible inputs, not passes. Actual unchanged
IKernel activation/client-interface and current native input/capture guards
must qualify and publish before any new ordinary original. None of these
requirements is waived; the new original remains unconsumed.

## Contracts and recovery

Microsoft [LocalServer32](https://learn.microsoft.com/en-us/windows/win32/com/localserver32)
specifies the executable command, ` -Embedding` and default 60-second
registration timeout. [CoRegisterClassObject](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-coregisterclassobject)
and [REGCLS](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/ne-combaseapi-regcls)
specify registration references, independent cookies, context and single-use
semantics. [Marshaling Details](https://learn.microsoft.com/en-us/windows/win32/com/marshaling-details),
[IRpcChannelBuffer](https://learn.microsoft.com/en-us/windows/win32/api/objidl/nn-objidl-irpcchannelbuffer)
and [IRpcStubBuffer::Invoke](https://learn.microsoft.com/en-us/windows/win32/api/objidlbase/nf-objidlbase-irpcstubbuffer-invoke)
define the actual proxy/stub channel route; metadata alone does not implement it.

The new test exports `prepare(directory)`, deterministic authored C inputs and
small import-library recipes using llvm-dlltool, clang i686 and ld i386pe.
Run recipes pin exact inputs, existing media paths, Git SHA and relevant patches.
Evidence contains no source archive, game-media copies, WASM or capture bundle.
No box, worker, browser or public deployment was created. Historical ancillary
UNKNOWN remains unchanged. This task's initial board watcher was joined through
the tool (143); separate pipe EOFs are not exposed and remain ancillary UNKNOWN.
