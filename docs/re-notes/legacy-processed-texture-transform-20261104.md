# Legacy processed texture coordinates: verified copy and TL bypass

2026-11-04. Starting implementation: accepted
`556e9ea2f0f56c65c6e3493e2774c99fc02c33e7`. Evidence:
`scratch/runs/20261104-legacy-processed-texture-transform/`.

No production rendering change is justified by this investigation. The actual
public legacy supplied-coordinate path copies separate texture sets through
ProcessVertices, then bypasses texture matrices when drawing its XYZRHW output.
This is verified implementation behavior and agrees with Wine's legacy copy
path. **It is not a new native Windows D3D7 conformance result.** In particular,
the available primary documentation does not settle whether native legacy
ProcessVertices must apply enabled texture transforms during production.

## Derivation and the remaining specification boundary

The original Microsoft DirectX 7 SDK (September 2, 1999), preserved by the Data
Dungeon Library, describes [ProcessVertices](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_43ac.content.htm)
as a conversion from untransformed source vertices to processed destination
vertices. D3DVOP_TRANSFORM specifies world/view/projection transformation.
[Processing Vertices](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_3grp.content.htm)
describes copying unaffected components with default flags, source immutability,
and XYZ source / XYZRHW destination formats. It does not explicitly specify
texture-matrix output-set allocation. Its description of copying texture
components under transform-only processing supports a copy characterization,
but does not prove behavior under every enabled texture-stage state.

The SDK's [texture processing path](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_1hyc.content.htm)
defines COUNT flags for the texture pipeline; it does not resolve their legacy
ProcessVertices interaction. Microsoft's current [texture-transform documentation](https://learn.microsoft.com/en-us/windows/win32/direct3d9/texture-coordinate-transformations)
explicitly excludes transformed, lit input from texture-matrix processing.
Thus a consumer that bypasses the matrix for XYZRHW is deliberate, and cannot
by itself be diagnosed as the defect.

Microsoft's later [fixed-function processing documentation](https://learn.microsoft.com/en-us/windows/win32/direct3d9/fixed-function-vertex-processing)
does specify generated texture sets and output dimensions for ProcessVertices.
That D3D8/9-style contract cannot silently be imposed on D3D7. Conversely,
consumer TL bypass does not establish whether the producer should already have
written transformed coordinates.

[Wine's legacy vertex-buffer implementation](https://github.com/wine-mirror/wine/blob/master/dlls/ddraw/vertexbuffer.c)
routes through [WineD3D process_vertices_strided](https://github.com/wine-mirror/wine/blob/master/dlls/wined3d/device.c),
which copies supplied texture sets without applying the texture matrix. This is
an implementation reference, not native Windows evidence. The existing
[Wine DDraw7 native-comparison tests](https://github.com/wine-mirror/wine/blob/master/dlls/ddraw/tests/ddraw7.c)
test ProcessVertices position output, including XYZ destinations; their
test_process_vertices does not test dimensional texture transforms. Bounded
reference excerpts and original download hashes are retained in the run.

## Actual module/public COM verification

`test/test-legacy-processed-texture-transform.js` is registered in the e2e tier.
It reuses the predecessor's public COM setup and independently authored byte
layout assertions. It executes the published x86 thunks for DirectDrawCreateEx,
QI, CreateVertexBuffer7, Lock/Unlock, ProcessVertices7, ordinary and indexed VB
draws, and render-target Lock readback. Calls check stdcall stack cleanup.
It never substitutes a synthetic producer or renderer.

The new pixel equation is separate from production and deliberately contains
no matrix multiplication: it interpolates the authored selected UV with RHW,
then samples the authored 16x16 texture. The expected-plan file is written
before executing the module. Full byte expectations are authored in fixture
code before running and checked separately using Python struct packing. Python
Fraction arithmetic independently verifies every expected and actual pixel.

Four cells cover ordinary/indexed draws, immediate/physical native Worker
queue. Each has 83 states: two mixed eight-set FLOAT1–4 layouts, selectors
0/1/2/3/7, disabled and ordinary COUNT2/3/4, two distinct nonidentity matrices,
constant/varying geometric w, differing destination dimensions, and missing
source sets. Source index two and destination index three are nonzero. Capacity
clamps process four records with count 0xffffffff; indexed draws select 3/0/2
and omit a poison record.

* 332 public draws, 996 analytic pixels and 332 complete destination-byte
  arrays pass; positions allow 1e-5 float rounding, other bytes are exact.
* 332 overlapping public calls preserve original per-set components; complete
  source allocations remain unchanged in non-overlap calls. Prefix/suffix
  sentinels, diffuse, unrelated sets, truncation and existing component defaults
  remain covered. These padding cases characterize existing behavior, not native
  padding conformance.
* 1,328 public guards and 664 invalid texture-count rejections preserve the
  destination allocation.
* 166 held type-3 physical queue records retain processed UV after public
  destination VB Lock/Unlock overwrite, index overwrite, and live matrix,
  selector and flag changes. Drained records reproduce the original pixels.
* Five successful-public-call controls are rejected: deliberate input
  pretransformation, dropped z, dropped w, wrong selector and wrong indices.
  Byte controls catch the errors before the TL draw can conceal z/w loss.

The serialized full build passes. The resulting normal module is unchanged:
SHA-256 `b748d9b5a16631762be84a6e1017ca095c192623bc288657488157d32f79c0ca`;
compatibility module:
`cafdf1fd380aadb73571c68fbd77612ba91d58178a05a6afc469ae858394c333`.
The new regression, independent audit, existing ProcessVertices test (including
legacy/v7 stdcall aliases), fog and camera-position texgen tests pass.

Seven accepted direct/VB evidence artifacts are reused with their exact
accepted hashes, verified by audit.json; the accepted direct raw result remains
`6a10966388a438c6a8fb42705ccccc72832960c932313ff00b6f77b07c5aef83`.
Those are historical results, not reruns or new GPU/application claims.

## Next application-facing gap and recovery

Before changing the legacy producer, obtain a native Windows D3D7
ProcessVertices-to-Lock reference with an enabled nonidentity texture matrix,
FLOAT3/4, a nonzero selector, and independent destination-byte expectations.
That distinguishes the legacy copy contract from a producer defect followed by
correct TL bypass. A visible application using this specific state is likewise
not demonstrated here. This task stops without a speculative production fix.

Only XYZRHW destination rendering is qualified; XYZ source positions are
transformed, not reused as screen positions. Native XYZ destination quirks,
COUNT1, PROJECTED, generated dimensional sets, strided input, cube/BORDER,
lighting expansion and physical GPU rendering are outside this evidence.
Existing lighting/fog tests are preserved; no new lighting capability is claimed.

Recovery uses exact Git SHA, relevant binary diff, and small owned-file patches;
module/media inputs are referenced by path, size and SHA-256. Large closed JSON
is gzip compressed with verified roundtrip hashes. No source archive, module
copy, game media, Chrome, remote runtime, API/box lifecycle, deployment or
subworker was used. No box is assigned; lifecycle ownership stays with the
coordinator.
