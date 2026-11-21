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

The single bounded original on published `63d47fe54` confirms that genuine
OpenCAB returns S_OK and ISetupCABFile calls proceed, followed by successful
component collection/item calls. This confirms the earlier integration's
progress; the name-lookup correction is qualified by its separate native tests.
The next typeinfo rejection is IID `DEF5FEEC-225A-11D3-88AA-00C04F72F303`.
An offline probe using the actual native SLTG metadata finds eight slots and
one rejected method: slot 5, output/retval pointer to VT_SAFEARRAY (27).
This needs an owned typed SAFEARRAY output codec and lifetime, not a validation
bypass. A later ISetupComponent slot 41 callback path also reports a stdcall
stack mismatch; its cause is not established by this run.

The personally reviewed whole 800x600 image still shows the support-file error
0x80004001. No physical input or native Quit is claimed. The parent reaches its
45-second guard and writes that image, but orderly shutdown stalls. Independent
80-second supervision sends TERM then KILL to its owned group and reports no
leaked processes. The registrar's wait/both EOF receipt is complete; Embedding's
wait/both EOF receipt remains incomplete, and killed-owner exit audits are
unavailable. There was no control endpoint, subsequent endpoint request or replay.
