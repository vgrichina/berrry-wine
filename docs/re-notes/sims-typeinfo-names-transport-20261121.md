# Native type-description name transport

Run: `scratch/runs/20261121-sims-typeinfo-transport/`.

The Nov 17 boundary notes describe an earlier tree. Main already contains
`a3ed13388` (owned type-description/inherited IDispatch transport) and
`fa85608f8` (native by-value VARIANT transport). Their tracked codec is clean;
this task neither adopts foreign WIP nor repeats registrar qualification.
The later integration note is
`sims-owned-native-typeinfo-dispatch-integration-20261117.md`.

The remaining ITypeInfo slot 10 was incorrectly classified as local-only.
It now uses the bounded UTF-16 name-array and DISPID-array codecs, with its
actual three-argument ABI. Names and parameter ordinals come from the real
native ITypeInfo implementation. All returned IDs validate before publication.
Wire names with interior UTF-16 NULs are rejected instead of silently becoming
shorter lookup requests; counted BSTR semantics are unchanged.

The exact base contract loaded from Git fails the native regression with
E_NOTIMPL while direct native lookup returns S_OK. The corrected proxy returns
the native HRESULT/IDs for mixed-case, unknown, member and parameter names.
Independent native memories, a nested lookup during real ReadFile suspension,
cancellation of a completed lookup, malformed names/counts and a malformed late
ID pass with no partial caller publication. The existing real proxy/stub
OpenCAB-shaped returned-interface, descriptor release, lifetime, retirement,
disconnect and allocation-failure controls also pass, ending with zero owned
allocations, exports, requests, pending frames and descriptor leases. Native
codec/owner/continuation regressions and the full locked build pass.

ITypeInfo Invoke still needs a design for its process-local instance pointer;
GetTypeComp, AddressOfMember, GetDllEntry and GetMops remain explicitly
unsupported by this transport. Full installation and native Quit are not
established by these controls. Any bounded original outcome is recorded in the
run's final `result.json`.

ABI source: [ITypeInfo::GetIDsOfNames](https://learn.microsoft.com/en-us/windows/win32/api/oaidl/nf-oaidl-itypeinfo-getidsofnames).
