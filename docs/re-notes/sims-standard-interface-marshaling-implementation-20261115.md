# Standard interface marshaling — 2026-11-15

Implemented standard IStream interface marshaling and an owned byte channel.
Actual genuine OLEAUT32 proxies and stubs now round-trip interface outputs
between separate OS processes and distinct memories, on main and real Worker
clients. The returned interface remains callable after releasing the original
interface, and the server finishes with zero object references. This is an
authored channel qualification, not LocalServer32 activation or ISetupMedia.
The ordinary original remains unconsumed; no browser, game input or box was used.

## Implementation

`CoMarshalInterface` queries the actual guest object's IMarshal, IUnknown and
requested IID on its owning continuation. The supported default path resolves
the real registered IPSFactoryBuffer, calls its actual CreateStub and writes
OBJREF_STANDARD bytes through the supplied IStream's actual Write callback.
Failed or short writes roll back stub and object ownership. It never serializes
a guest pointer. OXID, OID and IPID are opaque random identities; repeated
exports of the same canonical owned IUnknown retain object identity.

`CoUnmarshalInterface` reads and validates bounded standard bytes, resolves the
actual registered factory and calls its CreateProxy and proxy-buffer Connect.
The genuine proxy delegates to a native controlling IUnknown and an actual
IRpcChannelBuffer implementation. The channel copies RPCOLEMESSAGE method,
data representation, flags and bounded byte buffers through the authenticated
ProcessDesktop socket authority. Only the exporting owner executes the actual
IRpcStubBuffer Invoke. No guest address crosses this transport.

Normal packets transfer once. Each proxy lease and a table-strong packet retain
the exporter independently. CoReleaseMarshalData releases abandoned packets;
final retirement waits for accepted invocations and owner-side stub Disconnect,
Release and canonical object Release before acknowledgement. Identity and
requests are bound to an authenticated connection, thread, full invocation
generation and actual source/module hashes. Stale owners cannot receive late
success, replay calls or borrow replacement identity.

The continuation runner preserves the real caller's stack, nonvolatile
registers, EIP, thunk, SEH and full 64-bit child token across actual Sleep, DLL
loading and nested COM suspension. A failed ABI, trap, unsupported yield or
owner replacement never restores an abandoned parent as success. The WAT bridge
parks its original stdcall frame and stops the current decoded block before
host service; result reentry performs the documented argument cleanup.

The supported context is LOCAL within this authenticated runtime namespace;
normal and table-strong ownership are implemented. Empty binding
arrays do not advertise an external DCOM network resolver. Custom IMarshal, nonempty external binding lists,
table-weak lifetime, other destination contexts (including INPROC) and arbitrary remote QI refuse
unsupported operation. Browser runtimes without the owned scheduler refuse the
interface bridge. This is not general network DCOM or complete COM support.

The callback census checker accepts explicit new-producer reviews in the
existing revisions metadata, applying the same exact hash, shape, kind,
ownership and duplicate checks. The foreign base census and foreign op5 WAT
work remain byte-for-byte unadopted. No gate is waived.

## Genuine DLL registration and evidence

The pinned genuine `test/binaries/dlls/oleaut32.dll` has SHA-256
`baeb2f7c1b8be56738d34e1d1ddf8e0eebd3a633215dc1575e14656be38b939d`.
Its first observed real interface-output call was CoMarshalInterface at
original VA `6537efe5`, IID_IDispatch / MSHCTX_LOCAL / NORMAL, on its actual
stream. The predecessor `ea2f388901fb4344faf5945df781d4765e96f460` supplied
actual IStream HRESULT callbacks and deep BSTR handling.

Calling genuine DllRegisterServer revealed a separate existing registry issue:
RegOpenKeyA(HKCR,"Interface") returns missing-root error 2 and registration
returns 80070002. The fixtures do not seed that root or force registration.
They obtain the genuine PSDispatch IPSFactoryBuffer through actual
DllGetClassObject, publish that actual object through CoRegisterClassObject,
and declare its IID mapping with public CoRegisterPSClsid. Production lookup
uses CoGetPSClsid's process override or existing ProxyStubClsid32 registry data,
then actual CoGetClassObject/QI. No canned proxy/factory or substituted original
object is involved. Final fixture cleanup revokes the registration and releases
the actual factory.

The separate server is an authored PE accepting `-Embedding`. It marshals its
own object, emits the actual 68 bytes in two bounded debug messages, releases
its initial reference and services owned requests. An independently spawned
client receives those bytes on its command line. All subsequent calls and
returned interfaces use the authenticated byte channel. The Worker client
receives the main thread's command-line pointer through CreateThread's normal
parameter, runs every check, and must return zero plus set completion before
the main thread reports its checked result. This bootstrap does not test
LocalServer32 command lookup, server launch or live class publication.

Focused checks cover an independent exact OBJREF golden vector, every truncated
prefix, malformed binding extents, copied buffers, normal replay refusal,
table ownership, in-flight release, final exporter acknowledgement, stale
source/module/generation/connection rejection, caller retirement before and
after response, and explicit metadata review refusal. Native main/Worker
IStream fixtures additionally check exact bytes, delayed callbacks, six-argument
stdcall cleanup, short/failing streams, rollback, repeated table unmarshaling,
abandoned-data release and real refcounts. Genuine OLEAUT tests check PID,
embedded-NUL/lambda BSTR `[0041,0000,0042,03bb]`, interface output, shared
IUnknown identity and invocation after original/factory release.

Evidence and exact run outcomes are in
`scratch/runs/20261115-sims-standard-interface-marshaling-implementation/result.json`.
Shared and committed-HEAD-plus-whole-owned builds and native checks are retained
with actual waits, both EOFs, full source pins and sealed closure. Recovery uses
Git SHAs and relevant binary patches, including new owned files; no source,
media, WASM or capture archive is made. Historical missing receipts remain
UNKNOWN. The existing storage 78/79 EOF failure is preserved, not waived.

## Remaining activation work

The full Sims route remains unqualified. Next connect the existing real
LocalServer32 command and `-Embedding` launch to live class publication,
bounded activation wait and scheduled owner-side factory invocation using this
implemented byte channel. The unchanged genuine IKernel / ISetupMedia client
must then qualify end to end. The genuine registrar's missing Interface-root
contract also remains observable and unresolved. No ordinary original is
permitted on the strength of this authored channel pass.

## Primary contracts

- [CoMarshalInterface](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-comarshalinterface)
- [CoUnmarshalInterface](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-counmarshalinterface)
- [CoReleaseMarshalData](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-coreleasemarshaldata)
- [CoGetPSClsid](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-cogetpsclsid)
- [CoRegisterPSClsid](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-coregisterpsclsid)
- [MS-DCOM OBJREF_STANDARD](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-dcom/51312511-36e1-4ab6-993c-523643b11a29)
