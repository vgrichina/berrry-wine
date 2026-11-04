# Legacy strided dimensional texture ingestion

2026-11-04; input main `151b292c463374ecb005276a21ec83aae045a8a3`.
Evidence: `scratch/runs/20261104-legacy-strided-dimensions/`.

The actual public DrawPrimitiveStrided path lost supplied z/w before texture
transformation, read a second component for FLOAT1, and used eight bytes as the
default stride for every dimension. Both strided entry points now read the
declared dimension and retain supplied z/w through the same internal type 5/6
representation used by the accepted packed/VB path. Supplied selectors and
texture counts receive the existing FVF validation. Counts are bounded before
size multiplication and component-array reads, including multiplication-wrap
inputs. No ProcessVertices producer semantics were changed or inferred.

## Primary contract and independent expectations

The original Microsoft DirectX 7 SDK, built September 2, 1999, documents
[strided vertex format](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_6uqs.content.htm)
as independent or interleaved component arrays, with texture elements of one
through four floats, described by the ordinary FVF dimension macros.
[D3DDP_PTRSTRIDE](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_5mec.content.htm)
specifies byte distance between records.
[D3DDRAWPRIMITIVESTRIDEDDATA](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_5gys.content.htm)
defines eight independent texture-array descriptors selected with TEXCOORDINDEX.
[Texture formats](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_3k84.content.htm)
and the [texture processing path](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_1hyc.content.htm)
define dimensional inputs, matrix processing and COUNT/PROJECTED output.
Downloaded primary pages and their hashes are retained locally.

Two boundaries matter: the SDK explicitly excludes transformed vertices from
strided input, and it does not specify a zero-stride fallback. XYZRHW and zero
stride cells below preserve existing emulator compatibility behavior; they are
not native DX7 conformance claims. This repair does not advertise new caps.

Before production edits, the new regression authored independent component
arrays and the pixel equation, saved its expected plan, and executed the
canonical full module through genuine x86 vtable calls. No extracted WAT or
substitute renderer participates. For each vertex the oracle pads the supplied
vector with `(0,0,1)` as needed, applies the selected matrix for untransformed
input, and interpolates homogeneous coordinates with geometric reciprocal w.
For projected output the denominator is the selected COUNT component. The
authored 16x16 texture gives distinct parity colors; samples stay inside texels.

The baseline FLOAT3/set2/COUNT3 draw returned success but public surface Lock
readback at `(4,6)` was `[20,70,65]`, expected `[20,25,30]`. The original module
hash is `b748d9b5a16631762be84a6e1017ca095c192623bc288657488157d32f79c0ca`.
After repair the same public pixel is `[20,25,30]`.
`baseline-left-repair-right.png` is the actual complete 32x32 target before and
after, placed side by side; it was personally viewed. This is a synthetic
analytic regression, not application/gameplay evidence.

## Verification

`test/test-legacy-strided-dimensions.js` is registered in the e2e tier and runs
with `LEGACY_STRIDED_EVIDENCE=<directory> node test/test-legacy-strided-dimensions.js`.
It reuses the accepted public COM bootstrap and independently supplies strided
arrays. Each method call dereferences the acquired vtable and verifies x86
stdcall stack restoration. Texture upload and render-target readback use public
surface Lock/Unlock. The full canonical module supplies all rendering.

Four cells cover ordinary/indexed and immediate/actual held physical native
Worker draws. Each has 240 states: three mixed dimensional layouts, selectors
0/1/2/3/7, XYZ and compatibility XYZRHW, padded explicit and dimension-default
strides, independent arrays beginning after a padding record, ordinary and
projected COUNT2/3/4, nonidentity matrices, constant/varying geometric w,
aliased texture-array descriptors and absent selected arrays. Indexed draws
select nonzero indices `3,0,2`, omitting a poison record.

* 960 successful public strided draws and 2,880 analytic pixels pass.
* 480 held physical Worker records retain exact supplied coordinate bytes,
  diffuse/specular bytes, projected positions within float tolerance, and
  captured matrices. Before delivery, live component arrays, the entire strided
  descriptor, indices, matrix, selector and transform flags are overwritten.
  Drained pixels still match submitted values, without queue fallback.
* Full component allocations and descriptor sentinels remain unchanged by
  draws; 8,244 input-array comparisons pass. Forty no-rasterization guards cover
  zero/null/oversize/multiplication-wrap input and null/out-of-range indices.
  Eight invalid selector/texture-count calls return E_INVALIDARG.
* Five successful-public-call negative controls produce oracle rejection:
  wrong selector, dropped z, dropped w, forced eight-byte texture stride, and
  wrong indices.
* A separate Python audit uses Fraction arithmetic for every expected/actual
  pixel and struct packing for all 480 complete queue vertex arrays. It checks
  exact retained coordinate/color bytes and independent position/matrix values.
* Serialized `flock /tmp/wine-build.lock bash tools/build.sh` passes, together
  with the new regression, tier census, existing draw stdcall arity,
  ProcessVertices (including aliases), vertex fog and camera-position texgen.

The first repair test started before compilation finished and still used the
baseline module; it is retained as `repair-first/`, not counted as repaired
evidence. A null-array fixture initially sampled exactly on a texel boundary;
its translation was moved inside the texel. The first queue audit incorrectly
expected type 2 for disabled transforms; the actual encoder correctly stores
normalized type 3. Both unsuccessful fixture revisions remain preserved.
`final-v3/` is the complete passing run.

Nine exact accepted evidence artifacts (packed/VB plus processed-coordinate
audit/result) are verified by path/size/SHA-256 in audit.json. Their unchanged
matrix grids were not rerun. No new WebGL, GPU, full-27 or application support
claim follows from this software/native-Worker test. The unresolved native
Windows D3D7 ProcessVertices texture-producer question remains outside scope.
Lighting expansion, generated dimensional coordinates and COUNT1 are likewise
not qualified here.

Recovery uses the exact Git SHA, relevant binary diff and small owned-new-file
patches; Git holds the source. Module and bootstrap inputs are referenced by
existing path and SHA-256, without copies or source archives. Large closed JSON
is gzip compressed with verified roundtrip hashes. No Chrome, remote/API/box,
lifecycle operation, deployment or subworker was used. No box is assigned;
lifecycle ownership stays with the coordinator. Next: use a separately assigned
application that actually exercises this strided dimensional state, if visible
application evidence is needed.
