# Sims type-library and child-export boundary, 2026-11-15

Work in progress. Evidence: `scratch/runs/20261115-sims-typelib-child-export-boundary/`.
Predecessor order is TIMcritical994115, Q3schedule1037509, then this worker.
Both predecessors released, and personal actual-wait/both-EOF/PID-group checks
passed before existing source changes or any native run. No foreign WIP is adopted.

The previous ordinary original is permanently closed. Feature
`df42403751a84e476f6f66d957b4930c28c145df` and report
`3d087339589c66c790f433c4d256112f8e053cad` establish one actual TreatAs mapping
returning S_OK, child exit `0x80029c4a`, rejected child export, no completion
record or merge, and parent `0x80040154`. Consumed titlebar input and physical
UP did not establish dismissal or native Quit. No earlier attempt is retried.

## Read-only findings

The retained child log explicitly loads genuine OLEAUT32 at guest `0x738000`
and patches IKernel imports to it. Thus the unconditional WAT `LoadTypeLib`
failure is not evidence of the actual failing operation. The old filtered API
trace omits the type-library/resource/file operations needed to discriminate.

Pinned IKernel SHA-256 is
`985eb55ecb750da812876b8569d5f1999a30a24bcc54f9bab4d3fc44dfedb931`.
Its OLEAUT32 IAT entries are `0x46c284` RegisterTypeLib (ordinal 163),
`0x46c288` LoadTypeLib (161), and `0x46c2b0` LoadRegTypeLib (162).
Its PE has named TYPELIB resource ID 1, language `0x409`, RVA `0x9d1f8`,
size `0xd8ae`, format SLTG, resource SHA-256
`475c366495b0a699277ab0fcfab047a9ce9e043b1d8c6b30c3d2ccdb5841baae`.
Resource presence alone does not prove selection or loading.

Static helper `0x432423` obtains the module path through GetModuleFileNameA,
converts it to wide text, and calls LoadTypeLib at `0x4324db`. On failure it
replaces the extension with `.tlb`, converts again, and calls at `0x43256a`.
Its caller `0x432591` calls RegisterTypeLib at `0x43260b` only after success,
then releases the returned interface. Other static LoadTypeLib callsites
exist; this describes possible control flow, not observed original execution.

[Microsoft LoadTypeLib](https://learn.microsoft.com/en-us/windows/win32/api/oleauto/nf-oleauto-loadtypelib)
specifies standalone files and PE resources, default first resource, optional
numeric resource suffix, reference counting on repeated loads, and implicit
registration for names without a path.
[LoadRegTypeLib](https://learn.microsoft.com/en-us/windows/win32/api/oleauto/nf-oleauto-loadregtypelib)
selects registered versions and delegates loading to LoadTypeLib.
[RegisterTypeLib](https://learn.microsoft.com/en-us/windows/win32/api/oleauto/nf-oleauto-registertypelib)
persists library/interface registration, not coclass CLSID registration.
No fabricated ITypeLib pointer, HRESULT success, or installation state is valid.

The child completion exporter currently skips provider-backed entries and
rejects every resident key outside canonical C paths. Its error omits the key.
The general parent snapshot exporter strips only a C prefix, so a resident
non-C entry can be represented under a colon-bearing host directory. Whether
this produced the actual rejected key remains unknown until diagnostic evidence.
Any diagnostic must preserve rejection and leave completion absent.

The new pure-host candidate passes 17 adversarial keys, lazy-provider exclusion,
readonly-drive rejection, and nested failure without partial output. A synthetic
resident D file exported with the real general exporter and remounted through
the real include-path producer/VirtualFS retains its D key and is rejected by
the completion boundary. This proves that producer mechanism is possible; the
actual rejected original key is still unknown. No producer change is justified
from this control alone.

The SLTG data contains the literal imported-library reference
`*\G{00020430-0000-0000-C000-000000000046}#1.0#0#C:\WINNT\System32\StdOle32.tlb#`.
Current system-data/default registry entries provide stdole2 version 2.0.
The Microsoft LoadRegTypeLib contract requires the requested major version;
version 2.0 alone does not establish availability of 1.0. Whether this import
caused the old original remains an inference pending a fresh discriminating trace.
The generated controls separately
test version lookup, genuine resource loading, registration, and registration
after the genuine standard dependency is supplied through real APIs.

The existing Windows 98 SE ISO
`scratch/media/win98se-oem-x05-29232.iso` (SHA-256
`2adfb46df8a9c7bbd2f67bff07461cc2f9d9ec8e01f0e112cb044c9e3e62f607`)
contains `win98/WIN98_52.CAB:stdole32.tlb`, 7,168 bytes, SHA-256
`308e70310b4707f63095db73e67ba080cb67657abdcba7efe66f0f7f5ce017ed`.
The new native test includes a pinned recovery recipe. Only this data member
was retained as a generated fixture input; no cabinet/media copy or guest
execution was retained. Runtime defaults now mount this exact local-only data
and seed only the standard library 1.0 path beside the existing 2.0 path.
Recovery: `node test/test-sims-typelib-native.cjs --recover-standard test/binaries/tlbs/stdole32.tlb`
uses the pinned existing ISO/cabinet/member; the ignored binary is not committed.

TIM's explicit release was personally checked against its sealed closure:
123 actual waits with both EOFs, including direct native/watchdog/supervisor/
launcher roles, and 124 currently absent PIDs and matching groups. Q3 is next;
all preparation here remains LIGHT until Q3 also explicitly releases.

## Planned discriminating qualification

Generate ordinary native clients with the pinned genuine TYPELIB bytes as
resource/file data only. Never execute the unpacked IKernel or game as a
substitute original. Trace genuine OLEAUT32's file/resource/API boundaries and
HRESULT consequences. Qualify exact NULL-owner MB_ICONHAND|MB_OK client OK,
separate Cancel controls, and identity/dismissal/exit consequences. Reproduce
nonclient close before considering any hit-testing change.

Add bounded escaped rejected-key and entry/drive provenance diagnostics, with
absolute/traversal/drive/UNC/NUL/device/readonly/nested adversarial controls.
Repair a producer only when demonstrated. Keep path/completion/merge and all
input ownership guards strict. One new unchanged ordinary original is allowed
only after a material repair or necessary diagnostics qualify and publish.

## Native causal controls and repair

The generated client embeds only the pinned IKernel TYPELIB data and calls
actual genuine OLEAUT32. Its baseline LoadTypeLib succeeds, yields 87 type
infos, and repeated loading/release respects reference counts. RegisterTypeLib
then returns `0x80029c4a`: the actual registry trace requests standard GUID
`{00020430-0000-0000-C000-000000000046}` version `1.0`, finds only `2.0`, and
fails its `StdOle32.tlb` fallback search. Explicitly registering the pinned
standard data first makes IKernel-data registration and registered reload
succeed. The ordinary default data/path repair makes all eight generated
controls pass: self resource, standalone, indexed resource, missing-file
failure/NULL, registered standard 1.0/2.0, direct standard 1.0, and explicit
standard-first registration. Final interface release reaches zero. This proves
the dependency failure in the native control, not yet the old original's exact
operation. The one newly authorized original will trace the genuine IKernel
registration helper and actual registry/file selection.

Exact NULL-owner `MB_ICONHAND|MB_OK` client OK returns IDOK and exits natively.
A physical titlebar X baseline is consumed with timely physical UP but leaves
the same HWND/generation. Read-only fixture inspection establishes HTCLOSE,
the ordinary native nonclient release route, and the resulting queued
WM_NCLBUTTONDOWN/HTCLOSE. Adding MessageBox procedure close translation alone
still leaves that message queued and the same dialog alive. The parked modal
pump lacked posted-message dispatch. The repair dispatches one posted message
filtered to the owning built-in MessageBox HWND, without entering guest dialog
procedures or adding a continuation target. Its procedure translates HTCLOSE
through SC_CLOSE/WM_CLOSE and chooses the actual Cancel or sole OK button
result. No hit-testing, renderer/input/controller, source guard, focus/capture,
thread/process/HWND-generation rule changes. Final qualification passes 19 exact-error native tests and 18 NULL-owner
OKCANCEL native tests, including physical OK, X and Cancel with actual guest
exit zero, no host cancellation, and physical UP in 202–269 ms. Both shared
and committed-HEAD plus whole-owned full flock builds pass. Adjacent native
modal/shadow regressions and publication checks precede the original. A deliberately wrapped fixture input
method was correctly refused by the source guard and permanently closed; that
fixture was never replayed.

Worker-shadow MessageBox, reentrant common-modal continuation and MessageBox
A/W regressions pass. The optional older IDNO fixture cannot compile because
it names removed global `$esp`; the same failure is reproduced on untouched
committed HEAD, before the repair. This is a stale fixture limitation, not a
passing regression or a full-build failure. Both full builds remain green.

The unsafe completion guard is unchanged. Its bounded ASCII-escaped diagnostic
records up to 256 UTF-16 key units, total key length, resident provenance and
readonly-drive status. Adversarial absolute/traversal/drive/UNC/NUL/device,
readonly and nested controls still reject without completion, registry output,
partial write or merge. No producer normalization is changed without an actual
rejected original key. A fresh original is justified by the qualified standard
library repair and exact native dismissal repair, with additional discriminating
helper/API traces; it is not an unchanged retry.
