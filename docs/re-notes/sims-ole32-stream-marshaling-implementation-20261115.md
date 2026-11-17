# OLE32 stream marshaling implementation — 2026-11-15

The two HRESULT marshaling APIs are implemented with real IStream transfers,
including guest Read/Write callbacks. The actual OLEAUT32 loopback now returns
the server PID and a deep BSTR. Its interface output reaches the next missing
contract, CoMarshalInterface. Genuine LocalServer activation and ISetupMedia
remain unqualified; no ordinary original is authorized by this work.

## Contract and fixture

[CoMarshalHresult](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-comarshalhresult)
and [CoUnmarshalHresult](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-counmarshalhresult)
use IStream to carry an HRESULT. The documented null-stream failure is
STG_E_INVALIDPOINTER. The primary
[Wine implementation](https://github.com/wine-mirror/wine/blob/master/dlls/combase/marshal.c)
performs one four-byte Write or Read with the transferred-count pointer NULL,
propagating the actual stream HRESULT. On the target x86 guest these are the
four little-endian bytes of the HRESULT, including its high bit. This is not
an OBJREF or a guessed RPC packet. No retries, completion padding or status
translation are part of these two functions.

[Read](https://learn.microsoft.com/en-us/windows/win32/api/objidl/nf-objidl-isequentialstream-read)
can return S_FALSE and fewer bytes; callers must not infer a full transfer.
[Write](https://learn.microsoft.com/en-us/windows/win32/api/objidl/nf-objidl-isequentialstream-write)
accepts a NULL transferred-count pointer. Tests exercise actual guest methods,
including partial buffer modification on failure, rather than substituting a
host stream. Null output and missing methods are refused before invocation.
No borrowed-stream AddRef or Release is invented for these synchronous calls.

`test/test-sims-ole32-stream-marshaling.cjs` exports a preparation recipe for
authored main-thread and CreateThread candidates. It checks preserved GPRs
and ESP, exact bytes for eight HRESULT patterns, all zero-to-four-byte
transfers against five stream statuses, nested marshaling, Sleep suspension,
nulls, missing vtable methods, object reference counters, and the emulator's
own HGLOBAL stream. Preparation alone proves no native behavior.
The existing HGLOBAL implementation reports S_OK at EOF; the new API
propagates it and leaves untouched output bytes intact. This work does not
alter that preexisting stream policy.

Evidence belongs in
`scratch/runs/20261115-sims-ole32-stream-marshaling-implementation/`.
The predecessor releases were personally verified against SHA-256
`5a8709ed18f64ff565c138e430e95df274b1216a1b64606848878a8bc6dcb132`
and `b786ea7c396a8ddab027d8a374fea8f6fe9b33da797c0ad6db44d76e76df19df`.
Their 691/702 artifact hashes, 122/116 actual waits and both EOFs, and
123/164 absent PIDs/groups were checked. Historical ancillary UNKNOWN entries
remain unchanged. Drakan's subsequent release is required before shared
source, builds or native execution. Drakan subsequently released with receipt
SHA-256 `cca5ea895418e686eafbd670b9ed87d2fd5bad4ac3568447bcf8c72d1dccda2f`;
198 artifact hashes, 32 completed waits, 94 absent PIDs/groups and both free
locks were personally checked before claiming source/build/runtime ownership.

## Implementation

`src/09a7b-ole.wat` implements CoMarshalHresult and CoUnmarshalHresult, and
`tools/gen_api_table.js` supplies their append-only API entries and generated
dispatch/hash mirrors. There are no success-only exports for interface
marshaling. Existing API IDs remain unchanged.

Native emulator-owned streams use the existing stream helpers. Private guest
streams use stack-owned callback operation 38: Write receives a pointer to
the invocation's HRESULT word; Read receives the actual caller output. The
continuation returns the guest method's HRESULT and restores the caller's
stack. The frame remains owned by its actual guest thread across suspension
and nested calls. No host callback, shadow guest, global scratch buffer,
borrowed-pointer reference increment or cross-memory pointer transfer is used.
Foreign dispatcher op5 WIP remains unchanged and excluded from the
HEAD-plus-owned source view.

## Observed next contract

The shared-WAT/HEAD-owned-host diagnostic uses the pinned genuine OLEAUT32
SHA-256 `baeb2f7c1b8be56738d34e1d1ddf8e0eebd3a633215dc1575e14656be38b939d`.
DllGetClassObject, CreateStub, CreateProxy, Connect and the real stub's Invoke
complete. Both PID Invoke and BSTR Invoke return S_OK. The BSTR contains four
code units `0041 0000 0042 03bb`, checked by the authored caller.
This is a same-process loopback; the returned PID equals the caller's PID.

The third ordinary Invoke asks the real object for an interface output. The
actual OLEAUT32 call to CoMarshalInterface has stream `005ae2ac`, IID pointer
`00509368`, object `00404008`, destination context 0 (MSHCTX_LOCAL), reserved
context NULL and flags 0 (MSHLFLAGS_NORMAL). The IID's exact DLL bytes are
`0004020000000000c000000000000046`, IID_IDispatch. The six-byte call instruction
is `ff154c103465` at original DLL address `6537efe5`, with runtime return
`00545feb` and ESP `074ffd84`. These bytes were checked against the genuine
PE's section mapping and actual logged DLL base `00507000`.

[CoMarshalInterface](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-comarshalinterface)
requires the object's IMarshal or a default marshaler, and
[CoUnmarshalInterface](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-counmarshalinterface)
must construct the receiving proxy. The observed non-NULL IDispatch output
therefore needs an owned object identity, real registered proxy/stub,
channel transport and reference lifetime. The existing in-process pointer
stream cannot satisfy this LOCAL request across memories. No pointer-copy
shortcut, fabricated factory result or interface-export stub was added.

No interface round trip, live LocalServer32 activation, ISetupMedia method,
unchanged genuine client, ordinary original, input or native Quit is claimed.
The next implementation must complete that owned interface/channel contract;
HRESULT and BSTR loopback success alone do not qualify activation.

## Validation and limits

The required locked full build passes for the shared tree and for committed
HEAD `440beb7947d0b661afa1e6e9cc64da9410cd459d` plus the seven whole-owned
paths. Their module hashes are respectively
`a361a74b976f986d8cc9c7a2d01b67fc7cf02458471f304dcf2c035a29f876fd`
and `b1e49ee899833a5ca461b39b7858ea7d134b5c3e019f6ea89ebc89d930b419b7`.
The final locked shared build also passes and restores the first module hash.
Shared native diagnostics explicitly pair shared WAT (including foreign WIP)
with HEAD-plus-owned host JS. They are not mislabeled as a clean source
closure. The HEAD-plus-owned module excludes foreign WIP and reproduces the
same actual caller, IID, PID and BSTR observations.

Both final authored main and actual node Worker-thread candidates exit 0 on
both modules. The Worker returns through its real ThreadProc sentinel; its
parent checks thread exit status and a shared completion flag before printing
the retained success marker. Stream callbacks execute Sleep(20), which uses
the existing guest yield path; nested callback frames preserve the outer
value. All eight HRESULT bit patterns, 25 status/transfer-length pairs in each
direction, null/missing-method refusals, unchanged refs, and ESP/preserved
GPR checks pass. The local HGLOBAL stream is also exercised.

The four new focused evidence checks pass, including exact request/reply byte
lengths and the BSTR payload in both directions. Each missing preload
independently exits 1 before the runner loads. The interface-boundary native
exit 1 is an expected fail-fast observation, not an interface pass. Independent
watchdogs are armed before releasing each supervised command; none fired.

Existing `test-ole-callback-frame.js` and `test-ole-guest-callback.js` pass on
the shared tree and HEAD plus owned changes. The broader
`test-ole-storage.js` reports 78/79 in all three views: shared, HEAD plus
owned, and unchanged committed HEAD with **no** owned files. The identical
preexisting failure expects S_FALSE on an EOF read where the current stream
implementation deliberately returns S_OK. This change preserves that policy;
it does not claim that the broader storage suite passes.

The exact current Nova media, genuine libraries, stdole32 and both Worker-safe
preload hashes were rechecked by existing path. Actual native runtime mapping
hashes match the predecessor. No media, source-tree or module archive was
created. Git plus the relevant binary patch records source recovery; logs,
small authored inputs, source/module pins and sealed closure live in the run
directory. No browser, game capture, original installer or box was created.
