# Supplied-coordinate COUNT3 projection, 2026-11-04

Implementation baseline: published main `466b129a1` (full SHA recorded in the
run's provenance). Read alongside
[the advertisement correction](legacy-advertised-texture-contract-20261104.md).
PROJECTED remains absent from every public capability descriptor (`0xf3df`).
This change implements stage-zero supplied FLOAT2 coordinates on untransformed
vertices with TEXCOORDINDEX=0 and COUNT3|PROJECTED (`0x103`). It does not establish
the complete PROJECTED capability contract.

## Implementation

`d3dim_prepare_draw_vertex` already preserves supplied UV in the common
post-transform 32-byte TL vertex. The DrawPrimitive and indexed paths now mark
these prepared vertices with internal type 4 when supplied projection is active.
Type 4 has the same stride as type 3; the marker carries deferred texture
transformation, not a public D3D vertex type.

Geometric clipping continues to interpolate raw supplied UV with geometric
positions and rhw. A linear texture matrix commutes with homogeneous clipping,
so the software triangle terminal can transform these UVs after clipping.
`rasterize_triangle_textured` receives independent texture denominators. It
interpolates u'/w, v'/w and q/w, then divides at sampling. Its quotient-rule mip
planes use the same three quantities. Geometry rhw, depth, diffuse and fog are
not replaced with texture q. OpenGL's shared rasterizer call supplies unit
texture denominators and retains its existing coordinate handling.

The production command encoder copies TEXTURE0 into the otherwise-unused WVP
scratch of a type-4 TL state snapshot. TL replay never recomputes WVP. This
avoids dereferencing a mutable texture-matrix heap pointer during delayed
execution. The native Worker and GPU state override both read this owned copy.
No record/header size changes are required. Optional draw tracing accepts the
new marker, and shape diagnostics recognize it as a valid vertex type.

The legacy GPU adapter transforms the raw supplied coordinates into owned
40-byte executor vertices with FLOAT4 texture attributes. Their z component
holds texture q; position rhw remains independent. Existing fixed-function
lowering receives COUNT3|PROJECTED and emits the fragment divide by texture z.
Mip samplers keep their real MIN/MAG/MIP settings and decoded mip chains.

## Actual WASM consumer verification

`test/test-legacy-texture-caps-native.js --projected` adapts the existing public
texture consumer fixture without extracting WAT or fabricating COM objects.
It boots original `test/binaries/calc.exe`, acquires DD7/D3D7/Device7, creates
and locks real surfaces, and calls published vtables through x86 indirect
CALL instructions. HRESULT, bounded completion, stdcall ESP and guarded output
buffers are checked. Pixels come from public Surface7 Lock.

For **each canonical and compat module**, final runs assert:

- 216 positive sample pixels across direct and indexed Draws, physical native
  Worker replay, and direct/queued mip cases. Three interior positions are
  tested per state. Conditions include constant q=.5, q=1, nonconstant q,
  nonconstant geometric w, near-plane clipping, projection disabled/restored,
  and application-predivided coordinates.
- 72 additional clipped-away pixels retain the explicit public Clear color.
  Each sample starts with Clear, so earlier draws cannot hide missing clipping.
- Actual five-level 16x16 mip chains are acquired through public
  GetAttachedSurface and filled through public Lock. Four UV scales select
  distinct mip levels 1 through 4 using an independent rational-gradient oracle;
  perspective and clipped variants use the same oracle.
- Queued Draws capture their records before the live texture matrix and flags
  change. The physical production `lib/d3d-render-worker.js` consumes them in
  a separate WASM instance. Transport reports completed replay and zero queue
  fallbacks. These are native software Worker pixels, not GPU pixels.
- Five rendered negative controls fail specifically at PIXEL ORACLE after a
  successful public Draw and Lock: ignored projection, division at vertices,
  fixed level zero, omitted near clipping, and replacing the captured queue
  matrix with the later live matrix.
- Public caps still pass 47 calls / 55 descriptors, including every enumeration
  callback and GetCaps variant. PROJECTED remains clear.

The GPU observation hook separately invokes the actual legacy adapter's
preparation, native texture decoder and fixed shader compiler on public Draw
records. It checks owned FLOAT4 texture coordinates, preserved geometric rhw,
q retention and GLSL source division, including actual queued snapshots after
live state changes. Its target upload and Device submission are recording
boundaries. It neither renders nor contributes to the pixel assertions.

The existing mirror regression passes both modules: 480 exact sample pixels
and ten rendered rejection controls per module. Its automatic module-copy
write is suppressed in memory to honor the owner's evidence rule; all test
assertions and production fixture code execute unchanged. Existing
solid-coverage transport/eye fixture preflight passes in Node; that is source
and Device submission evidence, not new browser rasterization evidence.
Focused native mip, indexed-texture, second-instance Worker parity, OpenGL
raster (92 checks), command capture, optional draw tracing, GPU batching,
depthless-Z and fallback-counter checks pass. The fallback-counter fixture
needed current texture argument fields to reach its intended decoder-rejection
branch; it now also verifies short/invalid primitives with internal type 4.

## Recovery and boundaries

Evidence: `scratch/runs/20261104-legacy-supplied-uv-projection/`.
`final-*/projected/projected-observed.json` records observations, public calls,
transport counters and explicitly labeled GPU preparation records.
`final-*/caps/native-observed.json`, `mirror-*/result.json`, regression logs and
locked build logs record their respective checks. Provenance records exact Git
SHAs, relevant binary diffs, owned new-file patches, module paths/hashes and
the existing calc media path/hash. No source snapshot, archive, game-media
copy or module copy is part of this run.

Reproduce after a locked build, for both module paths:

```sh
node test/test-legacy-texture-caps-native.js --projected \
  --wasm=build/wine-assembly.wasm --sha256=<actual SHA-256> --out=<run>/projected
node test/test-legacy-texture-caps-native.js \
  --wasm=build/wine-assembly.wasm --sha256=<actual SHA-256> --out=<run>/caps
```

Use `wine-assembly.compat.wasm` for the compatibility module. No browser,
graphics context, game CLI, test box, deployment or subworker was used. No box
is assigned to this task; lifecycle ownership stays with the coordinator.

Unverified boundaries are actual WebGL1/2 shader acceptance and pixels,
including GPU clipping and projective mip derivatives; hardware execution;
game runtime behavior; COUNT4 and other coordinate dimensions/selectors;
generated-coordinate projective interpolation; singular/nonfinite texture q
policy and its cross-backend parity; and combinations such as cylindrical
wrapping/fog with this projection. Those require implementation/verification
before any PROJECTED capability restoration. This is not full texture-capability
or game acceptance.
