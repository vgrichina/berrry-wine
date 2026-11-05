# D3D7 ProcessVerticesStrided — 2026-11-05

Run: `scratch/runs/20261105-d3d7-processvertices-strided/`. Requested starting
revision: `03b16e2553ddbe7d879fea8524e9df479a97fa07`; shared-tree gate revision:
`c1baff1c3338e326207c52ca2969e32262e703cc`. Evidence records the implementation
commit, relevant binary diff/new-file patches and module/media path hashes;
no source archive or module/media copy is needed.

The [SDK7 method page](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_0u5g.content.htm),
[strided format description](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_6uqs.content.htm)
and Microsoft's preserved [d3d.h](https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/d3d.h)
establish seven arguments after `this`: operation, destination index, count,
strided descriptor, **source FVF**, Device7 and flags. The method page's
`dwSrcIndex` label is a typo; there is no separate source index. Component
pointers express source offsets. The catalog now describes eight arguments
including `this`; the x86 handler consumes 36 bytes including the return address.
Exact downloaded contract URLs/hashes are retained in the run.

The implementation gathers declared position, normal, colors and FLOAT1..4
texture components from twelve independent pointer/byte-stride pairs. It
stages all input and complete output before publishing destination bytes,
including overlapping source/destination storage. It packs ordinary XYZ into
XYZRHW destination FVF using device WVP/viewport and the existing supported
Device7 lighting stage. Individual UV dimensions truncate or zero-expand;
absent colors/sets become zero. DONOTCOPYDATA preserves unaffected destination
fields. LIGHT applies computed colors when device LIGHTING is enabled.

The [SDK7 viewport scaling matrix](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_8wx1.content.htm)
and its personally inspected `images/vpscale.gif` establish
`MinZ + (MaxZ-MinZ)*Z/W`, including collapsed ranges. This method applies that
mapping after the shared projection helper; existing ProcessVertices math is
unchanged and is not used as the expected-output oracle.

Invalid flags/operations, reserved/blended/transformed source FVF, incompatible
destination FVF, missing LIGHT normals, invalid/released objects, locked
buffers, destination overruns and null/unmapped/wrapping/short/zero-stride
component spans fail explicitly. CLIP/EXTENTS, fog, generated coordinates,
texture transformations and the shared lighting stage's unconfigured skip
return E_NOTIMPL. Zero count is a validated no-op. Allocation failure returns
E_OUTOFMEMORY. Rejections preserve the entire destination allocation.
The API supplies no source allocation lengths: mapped affine-span validation
cannot establish logical source-array capacity and conservatively rejects
non-affine guest mappings. The current gather limit is 131072 vertices,
matching the canonical packing helper. VB Lock/Unlock now track shared lock
state across interface aliases.

The new public x86 COM regression runs both shipped modules with independently
authored whole-allocation destination DWORDs and texture pixels. Coverage
includes padded separate/interleaved streams, nonzero pointers/destination
indices, all eight UV sets, selected dimensional sets, perspective/WVP,
nondefault viewport/depth, emissive and directional RGB, interleaved devices,
DONOTCOPYDATA, overlap, lock/release/recreate, invalid spans/flags and actual
heap exhaustion/recovery. Each Node module run checks 1200 COM calls, 105
output allocations, 58 rejection records and 43 pixel checkpoints. Wrong
stride/component/device state controls fail the designated byte oracle after
successful public processing.

Each module also passes actual browser software and direct WebGL (43 pixel
checkpoints each), and production queued WebGL (45). Held ordinary/indexed
VB draws retain correct queued vertices and pixels after source descriptors,
components, indices and destination VB are overwritten and the selected set
changes. Queue-corruption controls fail the pixel oracle. All six captures
were personally inspected (`capture-review.json`). The one local Chrome
exited normally with code 0, signal null. Its reported Intel/Mesa ANGLE
renderer is recorded, not treated as independent proof of physical GPU use.

Existing ProcessVertices, fog, VB aliases, interface specification, FVF
lighting, computed-lighting, dimensional ProcessVertices/VB and strided tests
are checked alongside the required locked full build; final command receipts
are in the run. Two stale fixture contracts were repaired: header unpack
leaves UVs to the separate dimensional copy helper (failure independently
reproduced using released source compiled in memory), and the older mip
adapter now accommodates the immediate fixture's mutable bindings/preview/
queue seams. Their byte/pixel expectations remain intact.

Computed-lighting alpha authority remains unresolved in the existing DX7
notes: computed alpha bytes are recorded but excluded from acceptance.
Unlit colors, positions, UVs and guards have full byte oracles. General
nonuniform normal transforms and float-to-byte rounding are not independently
qualified here. Native Windows parity, physical GPU, historical27 and gameplay
are untested. No leased box was assigned (ID/state/expiry not applicable);
coordinator retains shutdown ownership. MDK0600 then Strong0620 FINAL releases
and fresh normal cleanup/free locks were verified before shared edits or
execution (`release-gate.json`). Held investigations and game paths were
preserved.
