# Genuine remote QueryInterface — 2026-11-16

Authenticated remote QueryInterface now reaches the actual server IUnknown,
then marshals its owned interface result through the registered native
IPSFactoryBuffer. The unchanged IKernel client advances beyond the old
`80004001`/null boundary on main and Worker. Its actual server provider QI
returns S_OK/non-null; marshaling that interface next returns `80040155`
(REGDB_E_IIDNOTREG), with null client output. QueryService remains unreached.
No provider proxy/stub registration or provider implementation is fabricated.

## Implementation

`lib/com-owned-channel.js` queues a distinct authenticated QI request under the
existing process session, apartment owner, source/module generation and proxy
lease. A successful reply must carry the exact requested IID, the same exporter
owner and OXID/OID, and a committed, unused normal marshal packet. The authority
transfers its lease to the exact caller before publishing completion. Cancellation
and caller retirement discard unclaimed returned references, including delayed
completion, while the original export stays pinned during the actual callback.

`lib/com-owned-transport.js` carries this control and cancellation through the
existing authority protocol. Its optional evidence records actual exporter QI
HRESULT and pointer presence; guest pointers never cross the transport.

`lib/com-standard-marshaler.js` executes canonical guest IUnknown slot zero,
preserves its HRESULT and marshals the actual returned pointer. The returned QI
reference is released on ordinary completion. Identity mismatches discard the
packet. IUnknown-only exports retain canonical identity without inventing a typed
stub; typed interface exports continue to require the genuine registered factory.

`lib/com-owned-proxy.js` retains one controlling IUnknown per OXID/OID. Uncached
QI asks the exporter, imports its owned lease and aggregates the actual native
proxy under that identity. The original full-width invocation token, owner and
IID are checked around suspension. Ordinary HRESULT failures balance the call
pin and cancellation; traps or changed ownership do not replay or clean an
abandoned guest frame. The feature-owned callback census addition records this
new token reader; general callback ownership remains pending.

## Native evidence and exact next contract

The run directory is
`scratch/runs/20261116-sims-genuine-remote-queryinterface/`. It preserves the
frozen Git source SHA, exact relevant binary patches, recipes, input/module
hashes, raw protocol logs, native reports and independent watchdog/child waits.
`result.json`, `final-checks.json` and `runtime-release.json` index final evidence.
No source-tree archive, media copy, frame series or screenshots were produced.

The retained unchanged client/media/DLL recipe first reproduced provider
`80004001`/null. After the change, raw exporter evidence on main and Worker shows
provider IID `{f4817e4b-04b6-11d3-8862-00c04f72f303}` returning S_OK/non-null.
The next real CoGetPSClsid returns `80040155`. Native LoadTypeLib,
GetTypeInfoOfGuid, GetTypeAttr and GetDocumentation identify
**ISetupServiceProvider**, TYPEKIND interface, typeFlags zero, three functions,
vtable size 0x18, first method **QueryService**. Actual RegisterTypeLib returns
S_OK and still leaves that provider's PS lookup at `80040155`. A genuine
non-Automation provider proxy/stub is therefore the next required contract.
Mapping it to PSAutomation solely from metadata would not establish support.

The authored public-ABI fixtures use genuine OLEAUT DllRegisterServer,
stdole32 LoadTypeLib/RegisterTypeLib and the real DLL's IPSFactoryBuffer.
Their standard IDispatch interface is explicitly mapped with CoRegisterPSClsid
to the actual PSDispatch class obtained from genuine registration. This is
fixture setup for a supported standard interface, not a substitute provider
registration. The unchanged IKernel recipe receives no such registration.

Four main/Worker client/server combinations, concurrent clients and a caller
retiring during delayed actual QI exercise supported and independent unsupported
IIDs, GUID_NULL, canonical/shared IUnknown identity, checked stdcall stack and
callee-saved registers, balanced AddRef/Release, deep embedded-null BSTR,
returned interface use after original release and server finalrefs zero. Worker
completion markers are emitted only after all native body assertions pass and
the actual joined thread exits zero. Authority/proxy/exporter controls cover
stale generations/tokens, malformed replies, owner retirement, cancellation,
ABI/error/null output and trapped continuations.

Both actual Worker preloads remain required:
`scratch/sims-typelib-preparation-20261115/source-view.cjs` and `host-maps.cjs`.
Each is independently omitted in a refusal control. Genuine readonlyD,
exact IKernel/stdole32/OLEAUT/COMCTL+COMMCTRL pins and actual native loading are
retained. Real activation deadline tests retain legal 60-second waits without
timeout increases, fake clocks or shortened activation. Heavy execution is
serialized under `/tmp/wine-heavy-runtime.lock`; builds use
`flock /tmp/wine-build.lock bash tools/build.sh`.

Shared and frozen HEAD-plus-whole-owned source views are qualified separately;
final shared restoration must reproduce its module hash. Focused regression
results retain four existing failures: storage EOF (including the unwaived
78/79 history), extracted child mount, callback concurrency and callback tokens.
These failures are not waived or counted as passing. Earlier compilation,
registration and artifact-reader failures remain in the run directory with
actual waits; no failed run is relabeled successful.

## Shared checkout and limits

GTA2 and GL explicit FINAL source/build/runtime releases were personally
verified before existing source edits or runtime execution. Foreign
`lib/guest-thread-host.js` remains byte-exact at
`364bbcd12d1f55080aa9a5ae1d33545acc4e24a03574413954e36821aec1862b`;
all other foreign WIP remains unadopted. Historical missing ancillary receipts
remain UNKNOWN. The final closure records actual waits with both EOFs,
recorded PID/group absence, free locks and home free space above 1.5 GB.

No original installer, input/capture qualification, private game memory,
OCR/solver/autoactions, additional worker or box was attempted. Box ID is null,
state NOT_CREATED, expiry and stop receipt are not applicable. The existing
input/capture guards remain separately unqualified. Follow-on work must provide
and qualify the actual provider PS contract before claiming service progress.
