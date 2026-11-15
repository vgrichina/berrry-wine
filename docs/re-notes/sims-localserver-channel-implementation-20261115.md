# Sims local-server channel implementation investigation — 2026-11-15

Outcome: **genuine LocalServer32 activation and its cross-process channel
remain unimplemented.** No production change or ISetupMedia qualification is
claimed. The new native diagnostic reaches the actual automation stub's wire
path and fails at unimplemented `CoMarshalHresult`; this is a concrete
additional transport blocker, not a successful activation implementation.
The ordinary original, installation progress and native Quit are withheld.

Both current predecessors released before native work: GTA2 release
`67f6e10d…d54f` and ReVolt release `201be716…4ac0`. Their receipts and recorded
processes/groups were personally checked, along with free locks and disk.
The prior Sims historical UNKNOWN entries remain unchanged.

## Implementation boundary

`lib/storage.js` owns a per-process `sharedCom` class/cookie table. Its
`com_create_instance` first searches that table; without CLSCTX_INPROC_SERVER
it immediately clears the output and returns REGDB_E_CLASSNOTREG. There is no
LocalServer32 resolver or activation wait here. `test/run.js`'s
`spawnVfsChild` snapshots the registry at launch and merges only on native
child close. Its IPC listener receives readiness and exit messages, not live
class registrations or method calls. Publishing registry metadata earlier
would not supply the missing live factory.

The existing `comPendingScope` in `lib/guest-rpc.js` isolates an in-process
DLL name per calling thread. It is not an object channel. The existing
`_invokeComCallback` rejects a callback that yields instead of returning to
its exact sentinel. Server calls must therefore be scheduled on their actual
guest owner, with process, thread, generation, module/source and invocation
identity checked throughout suspension and return. A host shadow cannot
borrow a blocked guest stack.

The real ISetupMedia type information reports two HRESULT methods at vtable
offsets 12 and 16, both with interface-pointer outputs; the latter also takes
BSTR. Genuine OLEAUT32 CreateProxy success says nothing about either method.
The exact OLEAUT32 PE imports CoMarshalInterface, CoUnmarshalInterface,
CoMarshalHresult and CoUnmarshalHresult from OLE32; none has an entry in the
current API table. The native diagnostic below identifies CoMarshalHresult
as its first fatal missing API. The in-process inter-thread pointer stream in
`src/09a7b-ole.wat` cannot marshal these outputs across independent memories.

## Prepared test inputs

`test/test-sims-localserver-channel-implementation.cjs` exports `prepare(dir)`
for an authored separate server/client pair derived from the predecessor's
public IDispatch fixture. The client checks a different real server process
ID, a four-code-unit BSTR containing an embedded NUL and lambda, then an
interface output used after releasing its original object and factory.
The server requires the actual `-Embedding` command suffix and sleeps in
factory creation and Invoke. The client checks stdcall stack cleanup and
callee-saved registers around the actual Invoke call. These checks require
the future owner scheduler to handle real yielding guest code.
Only real guest implementations produce the output. A successful eventual
run must use the actual registered proxy/stub and owned byte transport;
the fixture itself does not implement either.

The same file exports a static PE import census so the exact DLL's marshaler
dependencies can be pinned without launching a guest. Preparing or compiling
these inputs is not activation qualification. The unchanged genuine IKernel
client remains a separate required qualification before any ordinary original.

A third authored candidate queries the four standard-marshaler exports using
public LoadLibrary/GetProcAddress calls. Its exit mask identifies actually
absent exports. Its observed result is below; it does not invoke or qualify a
remote object.

Two further candidates resolve the actual interface output type information
and exercise the public call sequence visible in unchanged Setup at
`0x405f89` and `0x406067`. The latter launches genuine IKernel `-RegServer`,
waits for its native child completion, requests the exact ISetupMedia IID,
and, if successful, queries `{f4817e4b-04b6-11d3-8862-00c04f72f303}` and calls its actual
vtable slot 3 with GUID_NULL and the registered ISetupInfo IID. It writes no
registry values. This authored client is a diagnostic for the genuine server;
it does not replace the required unchanged-client qualification. These
candidates were compiled. The separate deep server/client pair remains unrun:
there is no production channel capable of transporting their calls.

An additional local diagnostic connects a real OLEAUT32 IDispatch proxy and
stub with an authored IRpcChannelBuffer. SendReceive calls the actual stub's
Invoke and records request/reply sizes. The actual guest object supplies its
process ID, echoes the deep BSTR and returns an interface. This isolates the
real marshaler ABI from native transport, and remains explicitly a local
loopback test rather than cross-process activation.

## Native observations

Evidence is in `scratch/runs/20261115-sims-localserver-channel-implementation/`.
The HEAD-plus-whole-owned build uses source HEAD
`74fa0f977893fbd430ee52f37604290bdfcfd7bd` and produces module SHA-256
`ed7abcb17bc968d876e8d5ca598f4cb947c6a020dc9039c99ec31f86277c2bf6`.
Foreign source WIP, including the op5 dispatcher, is excluded from that source
view and preserved byte-for-byte in the shared checkout.

`marshal-exports` loads OLE32 through public APIs and observes NULL for
CoMarshalInterface, CoUnmarshalInterface, CoMarshalHresult and
CoUnmarshalHresult. Its real guest exit is 15, the four missing-export bits.
This is an observed capability absence, not an activation pass.

`oleaut-loopback-debug` loads the pinned real OLEAUT32 and runs its initializer.
Public OutputDebugString traces record DllGetClassObject, CreateStub,
CreateProxy and Connect returning S_OK. Connect makes a 16-byte method-7
request whose actual stub Invoke returns S_OK. The first ordinary IDispatch
Invoke then sends method 6 with 46 request bytes. Inside this actual stub
path, OLEAUT32 calls CoMarshalHresult and the interpreter fails fast:

```
UNIMPLEMENTED API: CoMarshalHresult
call site: oleaut32+0x6537d6fc (loaded address 0x005446fc)
native host exit: 1; independent watchdog did not fire
```

There is no returned Invoke HRESULT or completed BSTR/interface round trip.
This local diagnostic does not establish a cross-process factory/object call
or any genuine ISetupMedia invocation. Earlier file-only and virtual-console
reports did not preserve progress on the fatal exit; the debug-string run is
the selected evidence for the exact boundary. The metadata probe exited 0,
but its report export filter was too narrow and its output IIDs were not
recovered; no new output-type qualification is claimed from that run.

`kernel-client` mounts genuine read-only Disc1, the exact IKernel, COMMCTRL and
stdole32, and writes no registry entries itself. Genuine IKernel -RegServer
exits 0; actual native child close precedes the guarded merge of five files
and 298 real registry/INI keys. The real SetupKernel LocalServer32 value,
ISetupMedia ProxyStubClsid32 and TypeLib mappings are present. The parent's
single exact-IID CoCreateInstance still returns `0x80040154`, output NULL,
guest exit 110. Only the registrar child launches. No activation server or
follow-on QI/service call occurs. This authored public-sequence client is
diagnostic; it is not the unchanged original client qualification.

The entry requires exactly the two pinned Worker-safe preloads and the
source-qualified module hash. Removing either preload independently exits 1
before the runner or guest loads. Five focused retained-evidence checks pass.
Compiler declaration errors were corrected before guest execution; all six
authored inputs compile. Native/watchdog/supervisor-child actual waits, both
EOFs, recorded process/group absence and lock checks are retained separately.

The required shared-checkout `flock /tmp/wine-build.lock bash tools/build.sh`
also passes and restores shared module SHA-256
`878e49103bdeff048d0685ecc47a23d4f769310d66776a7e9fdbb2e884c9d7dc`.
It includes preserved foreign WIP and was not used for these native probes.
Source verification checks 16,278 recorded source pins in 62 files against
the exact committed source view. Current media, DLL and preload hashes are
recorded by path; no source tree, media or module archive is retained.

The next implementation must supply the real IStream-based HRESULT and
interface marshaling operations as part of the actual owned proxy/stub
transport, alongside LocalServer32 launch, live publication and owner-side
factory/object scheduling. A successful bootstrap packet, export addition or
same-process method pass cannot substitute for that full route. Delayed
registration, timeout/early exit, remote refcounts/revoke and replacement
refusals remain unqualified. No new ordinary original is authorized.

## Transport contract to exercise

Microsoft's [IRpcChannelBuffer contract](https://learn.microsoft.com/en-us/windows/win32/api/objidlbase/nn-objidlbase-irpcchannelbuffer)
places GetBuffer, SendReceive, FreeBuffer, GetDestCtx and IsConnected on the
channel. The [RPCOLEMESSAGE layout](https://learn.microsoft.com/en-us/windows/win32/api/objidlbase/ns-objidlbase-rpcolemessage)
carries the data representation, byte buffer, size and method number. Only
those bytes and validated identities may cross the process channel; Buffer,
reserved fields and interface pointers are process-local addresses. The
server's actual [IPSFactoryBuffer::CreateStub](https://learn.microsoft.com/en-us/windows/win32/api/objidlbase/nf-objidlbase-ipsfactorybuffer-createstub)
must connect the actual server interface to an IRpcStubBuffer. Its Invoke
executes on the owning server guest and returns bytes to the client proxy.

For interface outputs, the standard marshaler must publish an owned remote
object identity and construct a real client proxy through the registered
proxy factory. Neither copying the output pointer nor extending the
in-process pointer stream meets that contract. Revoke stops new activation;
outstanding interface references still own their server objects until actual
Release. Server retirement invalidates the endpoint generation and pending
calls; replacing a source/module, process, thread or generation must refuse
the old invocation rather than replay it.

The run-specific `scratch/runs/20261115-sims-localserver-channel-implementation/supervise.py`
prepares an independent watchdog before releasing a command through a pipe
gate. It records actual native/watchdog/supervisor-child waits and both pipe
EOFs. It was used for the native diagnostics and builds. No box was created.

## Existing transport candidate

`lib/process-desktop.js` already starts an authority and a bridge in native
Workers. Related CLI processes inherit its authenticated endpoint through
`ProcessDesktop.environment()`. The authority assigns a distinct session and
guest process ID, never recycles session identity, and retires sessions on
socket closure. Its current operation set concerns USER windows only. It is
a candidate carrier for live COM publication and bounded request delivery;
it is not an existing COM channel. Its synchronous metadata operations must
not execute a guest callback from a host import or a shadow instance.

COM dispatch would need a separate scheduler service on the actual registered
guest thread. The service must retain the current wait/callback ownership,
copy RPC bytes into server-local storage, call the real stub, drive allowed
yield/loader work on that owner, and revalidate identity before restoring the
interrupted state. The existing process-send broker demonstrates owned
request queues and nested wait reservations, but its WndProc adapter is not
an arbitrary COM invocation adapter. Neither existing component can be
relabeled as implemented activation.
