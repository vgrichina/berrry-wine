# D3D7 state blocks: contract and repair boundary

Source-only investigation, 2026-11-05. Inspected main
`b00672c90e56a3c538e867064a1976f1412612d4`; relevant uncommitted diff was
empty. Evidence: `scratch/runs/20261105-d3d7-stateblock-contract-cause/`.
**The snapshot implementation violates DX7 recording isolation, selective
Apply/Capture, typed membership, and value retention.** These are source-proven
defects, not a runtime reproduction or an identified game regression. No
production/test/helper/module changes, compilation, browser, game or box work
occurred. Held viewport, sparse-client and queued-texture assignments remain held.

## Primary contract and prior work

Reused the retained Microsoft-authored DX7 SDK `directx.chm` in
`scratch/runs/20261104-legacy-d3d-color-contract/`, whose provenance is described
in [the color-contract note](legacy-d3d-color-contract-20261104.md).
The [CHM mirror](https://raw.githubusercontent.com/oxiKKK/dx7sdk/0e34cd0ff275f5ed91c82963f75297623714acf3/dx7sdk-700.1/doc/directx7/directx.chm)
is pinned to `0e34cd0ff275f5ed91c82963f75297623714acf3`; topics carry a
September 2, 1999 build footer. This is primary Microsoft text preserved by a
third party, without authenticated original distribution/signature. Fourteen
selected topics were extracted locally; `primary-ledger.json` records their
exact bytes' SHA-256, original paths, readable mirror URLs and text. No network
retrieval or bulk SDK extraction was needed. Links below identify the same
topics; the local CHM bytes were the material actually inspected.

| DX7 topic | Requirement established |
| --- | --- |
| [Recording State Blocks, imover_2gf8](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_2gf8.content.htm) and [Begin, imref_8ias](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_8ias.content.htm) | Recording leaves live state unchanged. Recordable methods are LightEnable, SetClipPlane, SetLight, SetMaterial, SetRenderState, SetTexture, SetTextureStageState, SetTransform and SetViewport. Repeated writes retain the last value; operation ordering is not guaranteed. |
| [Capture, imref_8lno](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_8lno.content.htm) and [Capturing, imover_99no](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_99no.content.htm) | Capture refreshes only existing members. Its example explicitly preserves a two-member block containing SHADEMODE and texture stage 0. |
| [Create, imref_58o4](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_58o4.content.htm), [type, imref_049w](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_049w.content.htm), [predefined groups, imover_5pgk](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_5pgk.content.htm) | ALL=1, PIXELSTATE=2, VERTEXSTATE=3 capture current values of their groups; FORCE_DWORD is not a usable type. Groups overlap. The overview abbreviates names to PIXEL/VERTEX; use the enum/header spellings. |
| Begin above; [End, imref_26ck](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_26ck.content.htm); [Apply, imref_8u5g](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_8u5g.content.htm); [Delete, imref_8s6c](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_8s6c.content.htm) | Nested Begin fails with INBEGINSTATEBLOCK; unmatched End with NOTINBEGINSTATEBLOCK. Apply/Capture/Create/Delete reject during recording. Apply/Delete identify INVALIDSTATEBLOCK. Create identifies INVALIDPARAMS/OUTOFMEMORY; End identifies INVALIDPARAMS. |
| [Handles, imover_1fs4](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_1fs4.content.htm) and [Deleting, imover_6hic](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_6hic.content.htm) | Handles identify cached states within a rendering device; deletion deallocates the block and invalidates its handle. |

The complete DX7 group lists are retained in `imover_5pgk.htm`. Discriminating
entries: VERTEX includes matrices, user clip planes, light enable states,
LIGHTING and CULLMODE; PIXEL includes ZENABLE/ZWRITEENABLE, ALPHABLENDENABLE
and COLOROP. Both include SHADEMODE, FOGSTART/END/DENSITY and TSS
TEXCOORDINDEX/TEXTURETRANSFORMFLAGS. Do not substitute D3D9 masks. The summary
does **not explicitly enumerate typed membership for material, light parameters,
texture bindings or viewport**; their recordability is explicit elsewhere.
Their exact predefined-group membership needs additional DX7 evidence before
asserting a complete typed oracle. MultiplyTransform is absent from the
recordable-method list: its recording behavior also remains unestablished.

Prior-note/test searches found D3D9 selective/typed repairs and acceptance in
[the reset/state-block note](d3d-reset-state-crash-sweep-20261101.md), not a DX7
solution. `docs/watx-layout-migration-design.md:1183` only identifies the packed
12-byte D3DIM records. Commit `a4285df3ddabc3c8530d0bc5dee3f5939013ef64`
(“Snapshot D3D7 state blocks”) introduced the snapshot scheme without tests or
a contract note. No existing D3D7 cause solution was located.

## Current source findings

Line references below are to the inspected SHA. `09aa` means
`src/09aa-handlers-d3dim.wat`; `09ab` means
`src/09ab-handlers-d3dim-core.wat`.

* **Recording never intercepts setters.** `09aa:1123–1137` only sets one global
  device pointer, then snapshots that device at End (falling back to End's
  receiver even without Begin). The global's only consumers are Begin/End;
  no setter consults it. Getters and draws therefore observe recorded writes
  immediately. End creates a full snapshot, including untouched states.
* **Create ignores type; Capture/Apply ignore membership.** `09aa:1301` never
  consumes `arg1`. `09ab:947–1002` allocates/copies 4096 bytes on create,
  capture and apply. Applying even a one-state or empty recording overwrites
  unrelated current state. Capture cannot preserve a selective block's domain.
* **Indirect values are not captured.** The light table is a separate 832-byte
  allocation at state+3448 (`09ab:2779–2825`); snapshots copy only its pointer.
  A later SetLight mutates the alleged saved value. The texture block is a
  separate 544-byte allocation: eight matrices plus eight TSS24 words
  (`09ab:4078–4104`). Apply deliberately preserves the destination's +4024
  pointer (`09ab:981–989`) and copies none of its values. Thus recorded or ALL
  texture matrices/flags cannot be restored; typed flags fail too.
* **Control/ownership checks are absent.** Wrappers return success even on
  invalid tokens, unsupported types, absent recording, null output or failed
  allocation; helpers silently return. Nested Begin overwrites the recorder.
  End on B after Begin(A) snapshots A and clears the global. Records store a
  device slot but Apply/Capture/Delete never check it (`09ab:939–1013`);
  tokens can act on another device. Token indices are reused without a
  generation. The exact cross-device error and stale-token reuse policy are
  not established by the retained pages; missing receiver validation is clear.

| Recordable setter route | Actual state/value storage and related writes |
| --- | --- |
| SetRenderState → `09ab:1459` | +256+4*id; also texture-binding slot for legacy state 1, effective blend mode +3936 for state 21 |
| SetTransform → Device2 alias → `09ab:1394/1336` | Four inline matrices at +0; TEXTURE0..7 external at +4024; clears legacy transform-handle association +3360 |
| SetTextureStageState → Device3 alias → `09ab:4206/4044` | +2832 compact rows; +3552 extended rows; TSS24 external; effective mode +3936 and explicit mip marker +3940 |
| SetTexture → `09ab:3998` | Stage-zero DX slot +2824; higher binding stages currently not implemented |
| SetMaterial → `09ab:2756` | Inline 68-byte value +3376 |
| SetLight / LightEnable → `09ab:2792/2827` | External 104-byte records (currently indices 0..7); inline enable bits +3452 (indices 0..31) |
| SetClipPlane → `09ab:3242` | Six inline 16-byte planes +3456 |
| SetViewport → `09ab:4547` | Rect +3088, scale/depth +3104, origin +3120; clears legacy clip-normalization enable +3928 |

The 4KB copy also includes viewport-list ownership, creation-version metadata,
clip status and rendering scratch (`09ab:11–49`). Their inclusion is a design
hazard, **not evidence of a reproduced list corruption/crash**. Likewise, no
texture lifetime/refcount or multithreaded failure is claimed. Device teardown
at `09ab:9883–9989` does not retire the block table or recorder; cleanup belongs
in the replacement's ownership design.

## Smallest coherent repair and distinguishing public cases

Replace this subsystem in `09aa/09ab`, keeping public API identities/vtable
slots stable. Use a recorder keyed by underlying device identity (including QI
aliases), fixed membership masks per state ID/stage/transform/light/plane, and
owned value storage. Route the nine documented setters to recording storage
when active, leaving getters/draws on live state. Copy input structs at setter
time; last valid write wins. Share one selective transfer implementation for
recorded and predefined blocks; Capture freezes membership, Apply updates
only members and required derived state. Deep-copy selected lights, texture
matrices and flags; never transfer device-owned pointers, lists or scratch.
Preserve effective-state markers consistently with selected values. Validate
recording transitions, type/output/token/owner, propagate failure, and retire
owned storage on Delete/device destruction. Resource retention for recorded
textures needs a DX7-specific lifetime oracle; importing D3D9 AddRef counts is
not justified. This scope does not expand stage bindings, light indices or
other unsupported rendering capabilities.

Add a focused public x86 COM fixture using real Device7 creation and vtable
dispatch, HRESULT/ESP/output guards and public readbacks, not exported helper
calls. `tools/d3dim-methods.js:106–160` supplies slots (Begin/End 22/23,
Apply/Capture/Delete/Create 39/40/41/42). Required distinguishing cases:

1. Seed SHADEMODE and ZWRITEENABLE; record SHADEMODE twice. Getters during
   recording and after End retain the original. Apply installs the last
   SHADEMODE and preserves a subsequently changed ZWRITEENABLE. An empty
   Begin/End block must leave both unchanged on Apply.
2. Capture that one-state block after changing both states, then change both
   again. Apply restores only captured SHADEMODE. Repeat with separate TSS
   stages/IDs, clip-plane indices and light-enable bits to catch coarse masks.
3. Record SetMaterial, SetLight(0), SetTransform(TEXTURE0), TSS24 and a valid
   viewport; overwrite caller buffers before End and mutate live values after
   End. Public GetMaterial/GetLight/GetTransform/GetTextureStageState/
   GetViewport must restore recorded values on Apply; unrelated members stay
   live. The light case must preallocate its table to expose pointer aliasing.
   Test Capture on these indirect values as well. This specifies state-block
   behavior only; held viewport validation work is not reopened.
4. Create each type with distinct LIGHTING, ZWRITEENABLE, SHADEMODE, COLOROP,
   TEXCOORDINDEX and TEXTURETRANSFORMFLAGS. Change them all; Apply/Capture must
   follow the DX7 membership above, including overlap. ALL must restore light
   and texture-matrix values independently of later mutations. Avoid unresolved
   typed material/viewport/binding membership in the initial oracle.
5. Nested Begin, unmatched End, Create/Apply/Capture/Delete during recording,
   invalid type and zero/deleted token must return documented errors without
   altering live state or the valid recorder/block. Two devices and a QI alias
   must demonstrate receiver isolation; do not invent an exact foreign-token
   HRESULT without further DX7 evidence.

For rendering semantics, one later fixture should draw an interior flat-color
triangle before/during recording and after Apply, and a two-vertex directional
lighting or texture-transform case using independently chosen endpoint values.
Read pixels through public surface Lock. The pre-Apply image must retain live
state; post-Apply must reflect only selected changes. These are proposed cases,
**none run here**; no new pixel-rounding assumption is needed.

Existing coverage is adjacent: `test/test-d3dim-interface-spec.js` checks method
metadata/handler existence, not semantics; `test/test-d3dim-transform-alias.js`
checks dispatch aliasing; `test/test-d3d7-fvf-lighting.js` calls helpers with a
state override. `test/test-legacy-supported-computed-lighting.js` exercises
public COM setters/readbacks and ProcessVertices, but never state-block calls.
The D3D9 state-block tests exercise another implementation/version. Searches
found no D3D7 state-block semantic test in `test/*.js`.

No retained real-app D3D7 Begin/End/Create/Apply callsite was located in the
reviewed notes; Black & White 2 and Invisible War state-block evidence is D3D9.
The missing app evidence is an identified Device7 receiver/vtable, call sequence
and surrounding live-state/draw observations. Windows DX7 comparison, public
COM reproduction, exact unresolved typed membership, MultiplyTransform behavior
and texture lifetime remain unmeasured. Next work is the bounded repair plus
these regressions, once assigned; no runtime slot is requested by this note.

## Setter-reference supplement, 2026-11-05

Five additional Microsoft-authored DX7 SDK method topics were read from the
same third-party mirror and retained with exact bytes, SHA-256, size and URL in
`scratch/runs/20261105-d3d7-setter-contract-supplement/sources.json`. This is
documentary evidence, not an authenticated Microsoft distribution or a native
Windows measurement.

The [SetTexture reference](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_2s2s.content.htm)
explicitly requires the ordinary binding call to increment the surface's
reference count. Clearing the stage with NULL permits release. Thus ordinary
texture-binding ownership has a DX7 source; this does **not** establish the
additional reference-count behavior of Begin/End, Create, Capture, Apply or
DeleteStateBlock. Their exact resource-lifetime oracle remains open.

The SetMaterial (`imref_4g10`) and SetLight (`imref_0884`) topics describe
structure-valued device properties replacing earlier material handles and light
objects. SetLight replaces existing properties at the selected index. These
reinforce the need to preserve values rather than a mutable caller buffer;
neither specifies the missing predefined-block membership. SetViewport
(`imref_47c4`) likewise supplies no typed-block rule. Its ordinary validation
text does not reopen the held viewport crash task.

The [MultiplyTransform reference](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_1smc.content.htm)
specifies the supplied matrix multiplied by the selected current matrix, but
does not discuss recording. Its absence from the separate nine-method recording
list remains insufficient to invent a recording error or no-op. No production
change, build, COM fixture or game run was performed for this supplement.
