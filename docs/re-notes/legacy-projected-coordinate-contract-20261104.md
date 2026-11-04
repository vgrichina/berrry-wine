# Legacy supplied-coordinate projected contract extension

The public untransformed FLOAT2 path now handles COUNT2/COUNT3/COUNT4 |
PROJECTED and supplied coordinate selectors 0–7. Previously
`d3dim_supplied_projected` recognized only the exact flags `0x103` and selector
zero. The new public regression demonstrates that production defect and tests
selectors 0, 1, 2 and 7 with all three counts. PROJECTED remains **unadvertised**;
this is not full capability qualification.

Read with [the supplied COUNT3 implementation](legacy-supplied-uv-projection-20261104.md)
and [the completed prior WebGL matrix](legacy-queued-projected-completion-20261104.md).
The latter's actual rendered results apply to its COUNT3/TEXCOORD0 fixture;
they do not establish the newly extended GPU cases here.

## Contract and repair

Microsoft's [texture coordinate processing description](https://learn.microsoft.com/en-us/windows/win32/direct3d9/texture-coordinate-processing)
defines selection from supplied FVF sets, transformation output counts,
division by the last component, and ignoring excess components for a 2D
texture. Applied to transformed `(a,b,c,d)`, the 2D samples used here are
`(a/b,b/b)` for COUNT2, `(a/c,b/c)` for COUNT3 and `(a/d,b/d)` for COUNT4.
The COUNT2 second coordinate is therefore one for these finite positive
divisors. This is the direct consequence of dividing the two passed elements
by the last; it is not a new hardware observation. These are the same named
fixed-function states used by the legacy Device7 calls, not D3D9 runtime tests.

The [transformation description](https://learn.microsoft.com/en-us/windows/win32/direct3d9/texture-coordinate-transformations)
specifies 4×4 texture matrices and excludes already transformed/lit vertices
from this transform operation. The fixture supplies untransformed XYZ vertices;
it does not expand the public TL contract.

`src/09ab-handlers-d3dim-core.wat` now accepts exact legal projected flags
`0x102..0x104` with a supplied selector at most seven. FVF packing already
selects the FLOAT2 pair. For COUNT2/COUNT4, the live matrix accessor copies the
matrix into unused WVP scratch and puts the selected y/w divisor in its z
column. COUNT3 keeps its original matrix. Both numerator columns remain intact.
The existing rasterizer therefore continues to interpolate independent
`U/w`, `V/w`, `q/w` and divide only at sampling, including quotient-rule mips.
Clipping, geometric rhw and the 32-byte prepared vertex ABI are unchanged.

`lib/d3d-command-stream.js` performs the same column selection while capturing
the actual type-4 record. Its owned WVP scratch contains the normalized matrix
before delivery. Replay and the GPU adapter consume this snapshot without
consulting later live flags. The existing adapter still emits owned FLOAT4
texture attributes and canonical COUNT3 projected GLSL. No GPU compiler or
capability descriptor was changed.

The pre-repair public Draw succeeded but Lock returned `[60,70,30]` instead of
the initial COUNT2 oracle's `[20,25,30]`; `before/observed.json` preserves the
failure and module hash. The fixture was subsequently expanded, including
independently selected stable sample locations and stronger COUNT2 mip scales.
The final fixture and patch, rather than an archived source tree, are the
reproduction inputs for the repaired matrix.

## Actual offline results

`test/test-legacy-projected-coordinate-contract.js` reuses the original public
x86 indirect-CALL COM harness: original calc PE bootstrap, DD7/D3D7/Device7,
created mip surfaces, public Lock/Unlock, Set/GetTransform, stage setters/getters,
Clear, Begin/EndScene, DrawPrimitive and DrawIndexedPrimitive. Every call checks
HRESULT, bounded completion, exact stdcall ESP and guarded outputs. There are
no fabricated COM objects or direct host state setters in this public fixture.
Node canvas accommodations only receive a presentation copy; asserted RGB
comes from Surface7 Lock after actual WASM software rendering.

For **each normal and compat production module**:

| Check | Result |
| --- | --- |
| Direct and indexed, local and physical native Worker replay | Four cells, 155 draws and 465 pixel observations each; 1,860 positive observations |
| Legal count/selector/matrix states | 144 states: 3 counts × 4 selectors × 6 scales × independent geometric w on/off |
| Controls | Eight legal/disabled/malformed transitions and three near-clipped states; clipped-away pixels retain public Clear |
| Mips | Actual five-level 16×16 chain; independent quotient derivatives select levels 1–4 for every count |
| Held production records | All 310 queued draws held before delivery, then live selector/matrix/flags mutated through COM, then physical Worker replay and public Lock |
| GPU recording | 447 accepted production adapter submissions/compiler results: 149 local direct plus 149 each queued direct/indexed; every valid queued record compiled after mutation |
| Rendered fault controls | Six faults × three counts = 18 pixel-oracle rejections after successful public Draw |
| Generated prerequisites | Six public draws characterized separately; no generated pixel-correctness claim |

The negative controls deliberately alter caller state/coordinates through COM
or, for the captured-matrix fault, corrupt only the held record's owned matrix.
They independently reject ignored projection, the wrong supplied selector,
the wrong divisor column, divide-before-interpolation, forced level zero and
replacement of the captured matrix. They are test injections, not six additional
production defects. Positive expectations always come from the authored matrix
and selected coordinates; no production sampling or descriptor helper computes
expected colors. All three counts reject all six faults on both modules.

The rational oracle uses barycentric interpolation and independent geometric w,
then differentiates both quotient coordinates for mip selection. The spatial
texture distinguishes axes and levels. The unchanged two-byte tolerance and
analytic ±1/16-pixel sample stability checks prepare this same fixture for later
GL execution. Recording additionally checks each unclipped homogeneous GPU
component against authored inputs and checks rhw independently. Local indexed
software rasterization does not request an adapter submission; queued indexed
records do, and are checked explicitly.

The production GPU adapter, native texture decoder, fixed GLSL compiler and
real command encoder run in the recording checks. Target upload and Device
submission are intercepted. **There is no GL context, driver shader compilation,
GLSL acceptance, GPU rasterization or GPU readback in this task.** The physical
Worker pixels are native WASM software pixels. Recording is not rendering.

The predecessor native public projection suite also passes both modules
(216 positive pixels, 72 clipped Clear checks and five rendered controls per
module), as does the public caps fixture (47 calls / 55 descriptors per module).
PROJECTED stays clear. Focused command capture, GPU batching/fallback/depthless-Z,
fixed plan cache, draw tracing, generated camera position, native mip, indexed
texture, second-instance Worker parity and OpenGL raster tests pass. The locked
full build passes after the production edits.

## Generated coordinates and remaining boundaries

Microsoft's [generated-coordinate description](https://learn.microsoft.com/en-us/windows/win32/direct3d9/automatically-generated-texture-coordinates)
distinguishes camera-space position, camera-space normal, and reflection-vector
inputs, which replace supplied FVF coordinates. Position requires the world/view
transforms; normals require a real normal-bearing vertex path and camera-space
normal transformation; reflection additionally depends on position and normal.
They cannot be inferred from supplied-UV success.

The separate public characterization draws all three TCI high-word modes with
and without actual FVF normals. Set/Get round trips and Draw/Lock complete, and
all emitted prepared descriptors are type 3, never the new supplied type 4.
Their observed RGB is retained with `expected: null`; completing a call is not
generated projection acceptance. Source `d3dim_texgen` currently handles position
and normal, requires canonical D3DVERTEX for normals, returns supplied coordinates
for reflection, and divides generated texture coordinates at vertices. This
does not preserve general rational generated projection. The focused historical
camera-position test verifies its existing subset, not this missing contract.
Generated projection requires separate implementation and rendered proof.

Also unqualified: FLOAT1/FLOAT3/FLOAT4 input FVF dimensions (the current packer
and prepared ABI retain only FLOAT2), selectors 3–6 in actual public tests,
zero/negative/nonfinite divisors and cross-backend policy, multiple stages,
mixed programmed-pixel linkage, wrap/fog combinations, physical hardware and
games. Invalid flag words `0x100,0x101,0x105,0x203` are deterministic legacy
passthrough characterizations, not legal projected modes or validation policy.

The next GPU boundary is actual WebGL1/2 shader acceptance and readback for
this expanded fixture, normal/compat, direct/indexed and owning Worker routes,
including held-state and semantic faults. `fixtureSource()`, `plan()` and
`oracle()` are exported for that work and retain real GL/Worker routes. Browser
execution must supply the existing production dependencies and the unchanged
oracle/tolerance, and qualify the resulting pixels independently of recording.

## Reproduction and provenance

Evidence: `scratch/runs/20261104-legacy-projected-coordinate-contract/`.
`verified-normal/observed.json.gz` and `verified-compat/observed.json.gz` retain
calls, actual Lock arrays, oracle answers, prepared components, Worker counters
and faults. `compressed.json` records lossless gzip original/recovered hashes.
The evidence source seal records exact Git SHA, relevant binary diff, owned
new-file patches, module paths/SHA-256 and original calc path/SHA-256. No source
snapshot, archive, copied module or media bundle is used.

After a locked build:

```sh
node test/test-legacy-projected-coordinate-contract.js --plan
node test/test-legacy-projected-coordinate-contract.js \
  --wasm=build/wine-assembly.wasm --out=<run>/normal
node test/test-legacy-projected-coordinate-contract.js \
  --wasm=build/wine-assembly.compat.wasm --out=<run>/compat
```

No box, browser, game CLI, allocation, resume, lifecycle operation, deployment
or subworker was used. No box is assigned to this task. Historical
`bx_9n42uwvf` is outside this worker's custody; its state/expiry was not queried.
Lifecycle ownership remains with the coordinator.
