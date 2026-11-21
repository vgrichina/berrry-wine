# Sims registrar: CoGetMarshalSizeMax

The genuine objectps.dll registrar in `20261121-sims-global-cs` entered
DllRegisterServer, then repeatedly resolved OLE32!CoGetMarshalSizeMax to zero
inside native RPCRT4 at 0x0050b4c0. The original registrar did not return.
The two interrupted marshal-size workers left no relevant implementation diff;
the recovered child 500081 and registrar descendants were absent before editing.

The new append-only API row supplies the six-argument stdcall export through
the existing owning COM continuation. A synchronous ThreadManager query checks
the actual calling thread's balanced apartment count, including Worker broker
calls; an uninitialized caller receives CO_E_NOTINITIALIZED. Sizing never
initializes an apartment or creates a transport export.

For the supported standard path, sizing uses the same IMarshal probe,
canonical IUnknown, requested-interface QI and real registered proxy/stub
factory validation as CoMarshalInterface. Its bound comes from the standard
OBJREF serializer's header extent (68 bytes with the currently empty binding
array). Temporary canonical/stub/factory references are released. No packet,
IPID, public reference or transport identity is published by sizing.

Custom IMarshal objects receive their actual GetMarshalSizeMax vtable call,
with the caller's IID, object, destination context and flags. The returned
payload bound gains the 48-byte OBJREF_CUSTOM envelope; overflow and native
HRESULT failures fail explicitly. This sizing support does not implement custom
payload serialization/unmarshaling, which remains E_NOTIMPL in the existing
CoMarshalInterface path. Standard contexts other than MSHCTX_LOCAL and standard
table-weak mode remain explicit E_NOTIMPL, matching the runtime's capabilities.
Invalid context/flag values and reserved pointers are rejected. Writable size
outputs are cleared on failure; malformed unmapped memory remains subject to
the existing continuation memory fences.

Marshal rollback now also runs on unexpected continuation errors. Native QI
and stream-transfer scratch allocations use finally cleanup; a short or failed
IStream write abandons the prepared transport reference and releases the real
canonical object reference.

`test/test-com-marshal-size.cjs` loads an x86 PE with an actual ole32 import,
uses GetProcAddress independently, executes native QI/Release and custom
IMarshal code, and compares the bound with actual standard bytes written to a
real HGLOBAL IStream. Normal and table-strong packets are released through
CoReleaseMarshalData. It checks caller state, apartment teardown, invalid/null
arguments, unsupported contexts/modes, IID failures, missing proxy/stub
registration, custom failure/overflow, and short/failed native stream rollback.
Focused continuation, apartment, worker-import and thread-manager regressions
and the locked build are retained in `scratch/runs/20261121-sims-marshal-size-final/`.

The original registrar is run once after publication using the predecessor's
same executable and genuine DLL mounts, with finite native supervision. Its
observed next boundary belongs to that run's result.json; no installation,
factory or gameplay success follows merely from the focused API regression.

Contract references: [CoGetMarshalSizeMax](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-cogetmarshalsizemax)
and [IMarshal::GetMarshalSizeMax](https://learn.microsoft.com/en-us/windows/win32/api/objidl/nf-objidl-imarshal-getmarshalsizemax).
No Wine or Windows VM reference measurement was used.
