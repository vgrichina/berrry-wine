# Legacy COUNT1 texture output: documented unsupported boundary

2026-11-04. Input main `c4212edbb021880414c5934bbb20d7a0a908e97b`,
including strided repair `9abf9ecbf`. Evidence:
`scratch/runs/20261104-legacy-count1-texture/`.

The primary DirectX 7 contract explicitly excludes 1-D texture coordinates.
There is no documented supported 2-D sampling result for COUNT1, with or without
PROJECTED. This assignment therefore ends at the requested demonstrated
unsupported-contract boundary. No production change is justified by these
observations; there is no invented missing-v, divisor, or HRESULT repair.

## Original DX7 contract, established before expectations

The Microsoft DirectX 7 SDK's September 2, 1999
[Texture Coordinate Processing Path](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_1hyc.content.htm)
states: “Currently 1-D texture coordinates aren't supported.” It distinguishes
input coordinates, stage matrix processing and the number of output coordinates
passed to the rasterizer. Supplied FLOAT1 input is a separate issue: it can
participate in a supported transform producing two or more output coordinates.
Unsupported COUNT1 output does not invalidate that supported input route.

The original
[D3DTEXTURETRANSFORMFLAGS enum](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_8tgk.content.htm)
defines COUNT1 as expecting one output coordinate and PROJECTED as division by
the last output component. That general description does not supply a second
coordinate or override the explicit unsupported 1-D boundary. It also specifies
no required HRESULT for setting or drawing this unsupported state. Applying
D3D8/9 defaults, assuming COUNT1 produces `(u,0)`, or promoting the mathematical
scalar quotient to a native 2-D sampling contract would invent semantics.

Both downloaded primary pages are retained with SHA-256 pins. Web-tool retrieval
failed; direct HTTPS retrieval succeeded. The earlier packed/VB/projected and
strided notes were read, but newer-API references in those notes do not establish
this COUNT1 contract. No native ProcessVertices producer conclusion is drawn.

## Actual public characterization

`test/test-legacy-count1-texture.js` uses the accepted public x86 indirect-vtable
COM bootstrap against the canonical full module. It uploads the authored texture
through public surface Lock/Unlock and reads the actual target through public
Lock. Calls verify stdcall stack restoration and acquired vtable targets. There
is no extracted WAT, alternate renderer, fabricated COM object or private draw
invocation. Host canvas accommodations only receive a presentation copy.

Twelve cells cover packed, public VB and strided draws, each ordinary/indexed
and immediate/held physical native Worker. Each cell has sixteen states:
FLOAT1–4 supplied at nonzero set 1, with a mixed dimensional layout, fixed
nonidentity matrix, varying geometric w, and flags COUNT1, COUNT1|PROJECTED,
COUNT2 and COUNT3|PROJECTED. Only the eight states adjacent to COUNT1 are new
supported controls; the accepted large unchanged matrices are reused by exact
path, size and SHA instead of rerunning them.

All 192 public draws return S_OK. In particular, the 96 COUNT1 draws return
`0x00000000`, and the public stage-state setter/getter round trips complete.
There is no demonstrated error HRESULT to report. This is the emulator's
observed acceptance, not a native DirectX 7 acceptance guarantee. The 288 COUNT1
pixel observations have `expected: null` and an explicit unsupported boundary.
For example, FLOAT1/set1 at (4,6) reads `[60,70,30]` for COUNT1 and `[60,25,65]`
for COUNT1|PROJECTED. Neither color is asserted as native-correct.

Every held draw captures complete command bytes before live matrix, selector
and flags are changed through public COM. Before delivery, packed vertices and
indices are overwritten, VB storage is publicly re-Locked and overwritten, or
strided component allocations/descriptors and indices are overwritten.
All 96 retained records remain byte-identical after mutation. Independent
struct packing checks supplied components and input defaults, plus diffuse and
specular bytes. Every complete queued target Lock array equals its immediate
counterpart, including unsupported observations. All replay occurs on actual
physical Node Workers with zero queue fallback.

## Independent supported pixel oracle and verification

Before execution, expected-plan.json records authored vectors, the independent
oracle and expected pixels. COUNT1 expectations remain null. The supported
oracle pads missing input components with zero and w with one, applies the
matrix, interpolates independent geometric reciprocal w, and for projected
COUNT3 divides by the interpolated third output component. An authored parity
texture maps the resulting coordinates to distinct RGB values. Samples are
selected away from texel boundaries with the existing tolerance of two bytes.
A separate Python Fraction implementation recomputes all 288 supported pixels
and verifies their positions in the complete Lock arrays.

Three negative controls preserve successful public Draws and fail specifically
at the independent pixel oracle: COUNT2|PROJECTED in place of COUNT3|PROJECTED,
replacement of the selected divisor column with w, and removal of the matrix
translation that consumes default input w. They distinguish wrong count, wrong
divisor and wrong default component. None tests an invented COUNT1 pixel rule.

The exact full module hash is
`4ddc8336097ef4b8503c6e6d2bb7fb05a2a1084800322523c8959b7128ca217a`;
the required `flock /tmp/wine-build.lock bash tools/build.sh` passes and reproduces
that same hash. The new regression, independent Fraction/struct audit, complete
test-tier census and existing twelve-handler draw stdcall test pass. The new
fixture is registered in the e2e tier; run with
`LEGACY_COUNT1_EVIDENCE=<unique-directory> node test/test-legacy-count1-texture.js`.
No production source changed, so no pre-fix native pixel failure or production
fix is claimed.

The global evidence checker reports existing unrelated containment/metadata
errors; none names this run. This synthetic fixture has no game candidate ID.

The initial fixture failed because its deliberate packed index mutation was
not reset before the following draw. The next comparison failed because Node's
strict deep comparison distinguishes arrays from separate VM realms; converting
both arrays into the host realm fixes that fixture error. Final evidence is
`final-v2/`; unsuccessful iterations and their logs are retained. The standalone
audit initially lacked Pillow, then exposed a fixture-specific specular default
difference; the final audit uses standard-library PNG encoding and checks the
actual authored per-route specular values. These are test/audit corrections,
not production failures. The exact Lock-array strip
`count1-count1projected-count2-count3projected.png` was personally viewed: four
textured triangles with clear outside regions, ordered as its filename states.

Git SHA, relevant binary diff and small owned new-file patches preserve source
recovery. Modules and calc media are referenced by existing paths and SHA,
without copies or source archives. Large closed JSON is losslessly gzipped with
verified roundtrip hashes. No capability, GPU, full-27, gameplay or native
Windows producer claim follows. No Chrome, remote/API/box, lifecycle operation,
subworker or deployment was used; no box was assigned. Lifecycle custody remains
with the coordinator.

The concrete blocker to a semantic COUNT1 repair is the unsupported DX7 output
contract. Any future compatibility policy needs an explicit scope and native
D3D7 reference evidence; this assignment does not choose one. The documented
characterization is complete and this single-task worker stops.
