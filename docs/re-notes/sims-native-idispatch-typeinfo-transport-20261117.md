# Native IDispatch transport remains incomplete

No production transport correction is published by this task. Sims installation,
native Quit, FullT-db74d863, and BW2/IS11 remain open. The authorized fresh Sims
original was **not used**. Evidence:
`scratch/runs/20261117-sims-native-idispatch-returned-interface-transport/result.json`.

The prior `11d04acfc6c9065739415c24a4abe7e03d69182e` finding remains valid:
the genuine `ISetupMedia.OpenCAB` succeeds, and encoding the returned
`ISetupCABFile` fails eager validation of inherited IDispatch slots 4–6.
Neither OpenCAB nor its WORD argument handling was changed here.

## Additional native boundary

A small authored x86 fixture calls the actual WAT ITypeInfo AddRef and returns
that actual interface from its GetTypeInfo-shaped slot 4. The fixture executes
through `ComGuestContinuation`, with its real stdcall frame checked and restored.
It does not execute IKernel or implement an application or Microsoft provider.
The returned native ITypeInfo cannot currently marshal:

- Public `CoGetPSClsid(IID_ITypeInfo)` returns `0x80040155` (`REGDB_E_IIDNOTREG`).
- `ComStandardMarshaler.marshalReference` returns that same failure and a null
  reference; no successful proxy creation is claimed.
- `NativeAutomation.info(IID_ITypeInfo)` independently fails with `0x8002801d`
  (`TYPE_E_LIBNOTREGISTERED`). There is no dedicated standard ITypeInfo contract
  in that metadata adapter.

The native standard IDispatch metadata still passes slot 3 and rejects slots
4–6. Eager validation, the standard marshaler, proxy factories, WAT metadata,
and WAT Invoke behavior were left unchanged. No private registry seeds,
synthetic success, or cross-owner guest pointer copies were introduced.

Microsoft's [IDispatch operation ordering](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-oaut/ac9c502b-ac1c-4202-8ad4-048ac98afcc9)
and [GetTypeInfo contract](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-oaut/d1791851-6491-4289-8c57-25967ef7b9ed)
require handling the returned type-description interface. Adding canonical
inherited signatures alone would leave that positive return path unsupported.

## Unintegrated codec candidate

`lib/com-automation-types.js` is **uncommitted WIP**, with an exact new-file patch
and hash in the run. Nothing in the production runtime imports it. It contains
typed-value helpers for counted BSTRs, UTF-16 names, scalar and BYREF VARIANTs,
DISPPARAMS, EXCEPINFO and descriptor fields. It is a candidate, not an accepted
transport implementation.

The focused native controls passed seven groups and eleven malformed-value
checks. They cover embedded-NUL BSTRs, scalar/DECIMAL VARIANT bytes, a real x86
write through aliased BYREF storage, actual IUnknown reference marshaling and
retirement, a real x86 deferred EXCEPINFO fill callback, and reconstruction of an
actual native TYPEATTR into separately owned storage. Tracked candidate
allocations, authority exports/requests and native continuation frames finish
at zero. A retirement guard rejects new candidate writes and permits cleanup in
the existing owner's cleanup context.

These are local codec controls and a negative native marshaling boundary. They
do **not** prove a returned IDispatch-derived proxy/stub, inherited names/LCID/
DISPID/named-argument behavior, complete descriptor graphs, SAFEARRAYs, atomic
caller output publication, or transport cancellation/disconnection/nesting for
the candidate. The FUNCDESC/VARDESC helpers have no complete positive lifetime
qualification. Do not import the candidate or relax validation on its strength.

The canonical `flock /tmp/wine-build.lock bash tools/build.sh` passed. The native
controls used its compatibility module
`dcaefe74632b53f344649dfa67ae4bb937950d0c669576aa54f004629a865438`.
All 26 selected earlier proof hashes and 22 media/provider hashes were checked
and reused; reader/783 continuation/ordinal ABI/BW2 parser tests were not
blanket-replayed. Independent deadline watchdogs were armed before the build
and native controls. Their actual child waits and both stream EOFs are retained.

The concrete remaining blocker is a real owned standard type-description
transport, including descriptor allocation/release and returned-interface
lifetime, plus canonical inherited IDispatch contracts and their complete
proxy/stub tests. This task does not deliver that implementation. No fresh
original should be spent on this candidate. No boxes, workers, deployments,
source archives, media copies or downloads were created; no image or ordinary
input claim is made.
