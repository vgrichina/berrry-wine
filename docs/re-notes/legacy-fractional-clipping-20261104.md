# Fractional clipped texture interpolation: causal repair

2026-11-04. Evidence: `scratch/runs/20261104-legacy-fractional-clipping/`.
Initial Git: `20ea6f9ef791ba3ca0320d3e4942a20e6b9e8f06`.

The fractional failure retained by `fef7c1421` is a production interpolation
bug. Rounding a scanline endpoint moves the location assigned to its texture
attributes. It changes the sampled texel and depends on the clipped fan's
diagonal. The repair evaluates the texture numerator and denominator planes
at the actual pixel sample location, using unrounded clipped vertices.

The recovered original failure is
`20261104-legacy-clipped-depth-fog/final-normal/positive-false-false.json.gz`.
Both its compressed SHA-256 and the decompressed JSON SHA-256 were checked
against that run's recovery map before reading it. `recovered-witness.json`
records the map entry, original stack and failing observation. No archive or
source tree was expanded. The historical witness is unit geometric w, object
z `[-.5,.8,.6]`, Q coefficients `[.125,.875,.21875]`, constant fog alpha 96,
pixel `(8,12)`: actual `[130,34,161]`, expected `[115,34,147]`.

The independent geometry starts with screen vertices A=(0,0), B=(32,0),
C=(0,32). Unit-w near clipping cuts AB at `(160/13,0)` and AC at
`(0,160/11)`. Homogeneous clipping linearly interpolates the supplied
attributes at those intersections; it does not divide texture coordinates
before interpolation. The retained polygon is triangulated as a fan.
Viewport projection gives integer-centred D3D samples `(x,y)`, not
`(x+.5,y+.5)`. A separate unclipped public Draw/Lock control at `(5,6)`
selects `[20,25,30]`; the half-integer alternative selects `[60,25,65]`.

At `(8,12)`, the original triangle's weights are `[3/8,1/4,3/8]`.
The clipped fan triangle `(0,160/11),B,C` gives weights
`[11/16,1/4,1/16]`, preserving the same original attribute field. Device
depth is `.2375`, so this triangle beats the `.35` occluder. With authored
U=.5u+.25v+.09375, V=.125u+.5v+.15625, Q=.125u+.875v+.21875,
the rational coordinates are approximately `(.555498911,.643555638)`.
Point sampling a 16x16 texture selects `(8,10)`, RGB `[20,25,30]`.
Mixing with fog RGB `[173,41,219]` at factor 96/255 gives `[115,34,147]`.
The test separately checks that unit-w clipping preserves the original
triangle's interior texture field, independently of the clipped fan.

The old raster first rounds the generated vertex to `(0,15)`. At row 12,
the B-to-intersection edge has x=6.4, which it rounds to 6 while retaining
attributes evaluated at x=6.4. The long B-to-C edge is at x=20. Interpolating
between these mismatched endpoints at x=8 gives original-vertex weights
approximately `[.374025974,.260714286,.365259740]`, U/Q=.563249551 and
texel `(9,10)`, RGB `[60,25,65]`. The resulting fogged RGB is exactly the
retained `[130,34,161]`. Rounding only the vertices predicts column 8;
changing the sample centre to a half-integer also predicts column 8. The
rounded scanline endpoint is necessary to explain this witness.

Before editing production, both shipped modules reproduced this witness and
three related sample failures on all four routes: ordinary/indexed public
x86 COM Draw, immediately or through the actual production Node Worker.
Reversing vertex winding changes the clipped fan and removes the historical
failure. `before-normal/`, `before-compat/` and the retained original stack
preserve these disagreements. Characterization mode records mismatches and
does not establish pixel conformance. `first-repair-normal/` is an additional
strict failure against the original module, launched before the first build
finished; `repair-normal/` is the first completed repair build's passing run.

`src/09ab-handlers-d3dim-core.wat` now constructs U/w, V/w, Q/w and device-Z
planes from floating clipped TL coordinates for supplied-coordinate
triangles. The span evaluates them at integer sample centres before rational
texture division and depth testing. Vertex fog uses the same floating geometry
for its affine plane. Mip footprint gradients use those same rational planes.
The draw enables these planes around its raster call and clears the flag
afterwards. Geometric 1/w stays separate from texture Q. Existing coverage
rounding and diffuse-colour interpolation remain outside this repair.

`test/test-legacy-fractional-clipping.js` runs 48 scenes: original fractional
z, nearby `-.49`/`-.51` near intersections, integral near/far intersections,
and unclipped controls; two Q fields; unit/varying geometric w; both windings;
and constant/varying fog controls. Seven samples per scene include the
historical failure, nearby interior pixels, the sample-centre discriminator,
occlusion and clear. The oracle computes homogeneous clipping, screen
barycentrics, rational texture sampling and depth independently of production
helpers. Texture-only RGB comparisons are exact. Fog retains the preceding
fixture's two-byte bound for packed colour interpolation; it was not enlarged.

Both repaired modules pass 384 public draws and 1,344 RGB observations each.
All complete 32x32 targets agree exactly between ordinary/indexed and
immediate/physical Worker routes. Every texture-only winding pair agrees
over its complete target. Each queued route replays 96 commands, fences through
48 public Locks, and reports zero fallback. Captured records retain original
depth/write/LESS, fog, matrix, FLOAT2, z/w, 1/w and vertex ordering after public
state changes and source/index overwrites; complete command hashes remain
unchanged. Module results and full observations are retained separately.

Varying-fog whole-target winding equality is deliberately not claimed:
unit-w winding pairs differ at 35 pixels by at most one byte, and varying-w
pairs at 171 pixels by up to six bytes. The reference specifies the clipped
fan and passes its selected samples. Packed intersection fog quantization
and, for varying w, homogeneous intersection followed by affine screen fog
make that field dependent on triangulation. Arbitrary fog triangulation,
fractional coverage boundaries, diffuse colour and all legacy raster
semantics remain unqualified; these differences are not hidden by larger
tolerances. The repaired texture mismatch and texture winding invariance are
the bounded result.

Validation includes the locked full build, both-module fractional matrix,
both-module preceding clipped/depth and variable-Q/fog matrices (including
their rendered negative controls), indexed-texture and second-instance Worker
neighbors. Reproduce offline:

```sh
flock /tmp/wine-build.lock bash tools/build.sh
node test/test-legacy-fractional-clipping.js
node test/test-legacy-fractional-clipping.js --wasm=build/wine-assembly.wasm --out=<run>/normal
node test/test-legacy-fractional-clipping.js --wasm=build/wine-assembly.compat.wasm --out=<run>/compat
```

Default invocation validates the analytic plan only. Repaired module SHA-256:
canonical `018c94ffbde8c857587c25c860db988d603d0662df9a18901f00c183af7493cd`,
compatibility `4e684af48e4ec06ae8aada0d5cd2b522345a7a51b8ed89988d4d8fa0d75ea7c2`.
Original module hashes were `78a0b1d6…` and `99b579cd…`; exact hashes and
existing paths are in provenance and the preceding run's recovery record.
Git commit plus relevant binary diff and new-file patches are the source
recovery recipe. Module/media paths and SHA-256 are recorded without copies.

No Chrome, boat, game runtime, shared heavy-runtime lock, npm, subworker or
deployment was used. No capability, GPU, Windows or gameplay result is claimed.
Box ID/state/expiry: not applicable; no box was assigned. Runtime shutdown
remains coordinator-owned. This assignment stops after publishing the tested
repair; the broader fog/coverage questions above remain separate work.
