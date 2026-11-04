# Legacy unbiased raster repair: first unsupported dependency

No production repair was implemented or accepted. The first unresolved dependency
is a solid-triangle coverage mechanism that generates the required fragment
invocations and carries primitive-local edge information. The current solid
backend submits original indexed vertices directly to GL. Correcting attributes
inside its fragment shader cannot restore an invocation that geometry omitted.
This is a concrete boundary in the existing implementation, not a claim that
a portable replacement cannot be written.

Predecessors: integer-center diagnostic at
`930f2cc11d95f498dc40daff39d8f224e5ccd73b`, and nonsolid public filtering
failure at `e8647f27fa54b1e37afbb5faeaef8729099a7c89`. The independent public
oracle, tolerance 2, queued path and five retained observations are unchanged.
MIN LINEAR still expects `113.752/42.28/103.404992`, with retained queued
Worker WebGL1 readback `121/50/107`. No fixed LOD or fallback bypass was added.

## Derived separation and the missing implementation

For a consistently oriented triangle, write each unmodified edge as
`E_i(x,y) = A_i*x + B_i*y + C_i`. Coverage accepts positive values and accepts
zero only for a top/left edge. If an agreed integer coordinate representation
makes every edge evaluation integral, this comparison can equivalently use
`E_i >= 0` for inclusive edges and `E_i - 1 >= 0` for exclusive edges. That
one-unit adjustment belongs only in the coverage predicate. It must never be
used in interpolation weights, and it is not a displacement of the vertices.
The representation must follow the actual clipping/snapping contract; choosing
a convenient grid in a test does not establish that contract.

Unbiased screen barycentrics independently define the attribute planes:

```
Q = sum(lambda_i * RHW_i)
N_u = sum(lambda_i * RHW_i * u_i)
u = N_u / Q
du/dx = (N_ux * Q - N_u * Qx) / Q^2
z_device = sum(lambda_i * z_device_i)
```

V and smooth perspective color require their own numerators and the same Q.
Affine color uses its own affine plane. Device depth is affine, rather than
another numerator divided by Q. Any reconstruction must reach the fragment
combiner and the mip footprint calculation before sampling, with the gradients
at the corrected position. Exact numerator/Q transport is analytically valid;
first-order correction of divided UV and reuse of displaced gradients are not.

The strict-interior witness `(0,0),(8,0),(0,8+1/32)` covers integer center
`(4,4)` with all barycentric weights positive. The existing displacement
evaluates coverage at `(4+1/16,4+1/16)`, which lies outside. Even exact rational
attribute reconstruction cannot run at the omitted fragment. For the shared
positive diagonal `(0,0)->(8,8)`, the same displacement is tangential. It
cannot choose which complementary hardware edge policy owns a tie.

The ES2 specification guarantees a single owner for matching shared edges but
does not select D3D's top-left owner; see section 3.5.1 of the
[OpenGL ES 2.0 specification](https://registry.khronos.org/OpenGL/specs/es/2.0/es_full_spec_2.0.pdf).
The test uses an opposite complementary tie policy as a portability
counterexample, not as a newly measured GPU policy. WebGL1 derivatives and
fragment depth writes also require the optional
[OES_standard_derivatives](https://registry.khronos.org/webgl/extensions/OES_standard_derivatives/)
and [EXT_frag_depth](https://registry.khronos.org/webgl/extensions/EXT_frag_depth/)
extensions. Their presence alone would not solve missing coverage.

The complete solid submission spy reaches `Device.draw`'s final `gpu.draw`
for WebGL1/2, POSITIONT/transformed input and list/strip/fan topology: twelve
cases, two submissions each. It observes original vertex bytes and indices,
only the original three input attributes, no conservative solid expansion,
and no fragment edge/depth reconstruction. Each case reuses one actual backend
program-cache entry. Ordinary fixed draws request neither optional extension.
The earlier assembly capture separately retains the actual mip wrapper.
These are backend execution/source-boundary checks, not GLSL compilation or
rendered pixels.

Reusing the existing outline expansion is not an implemented alternative:
`Device.draw` gates it to non-solid modes and WebGL2, and its coverage is for
points/lines. A solid replacement needs its own coverage and primitive-data
transport, handling clipping, generated edges, snapping, culling, depth/stencil
and unbiased attribute/LOD planes. Merely removing the shift delegates ties
to GL; retaining it and changing UV leaves coverage, color and depth defects.
No such partial candidate was installed. Clipping/snapping behavior remains
unchanged because production remains byte-for-byte unchanged.

## Tests and retained rejecting gates

The extended diagnostic preserves the 69 selected interpolation samples and
14 original edge cases. On inspection those 69 samples comprise 66 strict
interiors and 3 boundary samples; the predecessor's blanket description as
interiors was too broad. Reversing triangle winding with corresponding vertex
attributes adds 69 rational UV/color and affine-depth transport checks. The
horizontal/vertical fixtures were corrected to share both seam endpoints.

A second independently written coverage implementation uses BigInt edge
coefficients on an authored 1/32 fixture lattice. It agrees with the original
edge predicate on 490 paired grid cases covering both diagonals, horizontal,
vertical and oblique seams, both windings. Rectangle interiors have no holes
and adjacent triangles have no double ownership. Fourteen diagonal samples
show ownership-sensitive blend and depth differences under the legal opposite
tie policy. These are analytic blend/depth controls, not rendered tests.

`test/test-d3d9-fixed-top-left-bias.js` still characterizes the retained axis
displacement, but now explicitly rejects promoting it to a general exact
top-left guarantee. Its strict-interior and tangential-diagonal controls pass.
No production source comment was treated as evidence of portability.

```
node test/test-legacy-integer-center-interpolation.js --evidence=scratch/runs/20261104-legacy-public-mip-nonsolid-filter/browser/result.json
node test/test-legacy-integer-center-interpolation.js --require-unbiased-raster
node test/test-legacy-integer-center-interpolation.js --require-integer-center
node test/test-d3d9-fixed-top-left-bias.js
node test/test-d3d9-fixed-plan-cache.js
node tools/test-tiers.js --check
flock /tmp/wine-build.lock bash tools/build.sh
```

Diagnostics, axis controls, plan cache, tiers and the locked full build PASS.
`--require-unbiased-raster` deliberately exits 1 with
`MISSING_SOLID_COVERAGE_TRANSPORT`; `--require-integer-center` deliberately exits
1 at perspective U `0.3735632183908046` versus `4/11`. Both failures are retained.
The bounded current-source recognizer must be extended for a future repair;
passing these diagnostics alone would never qualify that repair.

## Evidence and runtime handback

Run: `scratch/runs/20261104-legacy-unbiased-raster-repair/`. Recovery uses its
exact Git SHA, `relevant.patch`, owned new-note patch and file hashes. Git is
the source archive. Relevant production and public-fixture diffs are empty.
No source tree/archive or media was copied into evidence.

The locked build reproduces the retained original modules exactly:

- Canonical, 2,143,712 bytes:
  `1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`.
- Compatibility, 2,146,325 bytes:
  `74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66`.

There is no changed candidate module identity. The predecessor browser modules
remain in place; no duplicate module recovery was needed. No browser was
allocated or launched, so no staged HTTP/bootstrap validation, controlled
old/candidate rendered comparison or remaining public cell was executed.
The first unsupported dependency was established offline, before staging.
There is no rendered repair, full27 or physical-GPU claim.

Assigned runtime `bx_e5cc38rs` was independently checked APIidle, healthok,
hydratedtrue and actual exec exit 0, then ACKed on the shared messageboard.
It is handed back RUNNING, expiry `2026-11-04T05:40:37.336Z`; shutdown belongs
to the coordinator. No persistent helper was started. No lifecycle action,
other-box access, local Chrome/game runtime, subworker, successor, deployment
or Heroes II work occurred. Next required implementation is the solid
coverage/primitive transport contract, followed by rendered oblique shared-edge,
perspective color/depth and canonical queued Worker WebGL1 regression before
the remaining matrix.
