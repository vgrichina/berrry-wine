# Legacy integer-center interpolation: offline causal boundary

No production repair was established. `lib/d3d9-fixed.js` and
`lib/d3d9-backend.js` remain unchanged. The new offline diagnostic independently
reproduces the first public expected color, exposes the emitted mapping's
interpolation error, and retains a rejecting integer-center gate. It does not
qualify rendered pixels, queued execution, or native D3D conformance.

Read predecessor note at `e8647f27fa54b1e37afbb5faeaef8729099a7c89`:
`docs/re-notes/legacy-public-mip-nonsolid-filter-20261104.md`. Its original
`scratch/runs/20261104-legacy-public-mip-nonsolid-filter/browser/result.json`
is retained in place and checked by this diagnostic. All five actual/expected
observations agree with the independently authored sampler. The fifth still
fails at tolerance 2. Neither the public fixture nor another worker's helper
was edited.

## What the source establishes

The legacy `lib/d3dim-gpu.js` triangle submission builds POSITIONT attributes
and fixed-function state, then submits them to the shared backend. This route
uses `Fixed.TLCache.compile`/`Fixed.compile`, rather than `draw.nativeFixed`.
In `lib/d3d9-fixed.js`, screen vertices receive `(0.5-1/16)` in both D3D
screen axes before the GL y flip. Clip W is the reciprocal of input RHW.
UV and diffuse outputs retain their vertex values. The transformed fixed
vertex path has the same screen displacement. `lib/d3d9-backend.js` compiles
this fixed vertex source unchanged; its mip fragment wrapper consumes `ff_uv`.
The new test captures actual backend program assembly at `createProgram`,
stopping before uploads or GL compilation. This is explicitly a source test,
not a substitute for the queued public path.

The backend's separate `draw.nativeFixed` branch adds `(0.875,-0.875)*W/extent`
after its shared clip IR, which encodes the same half-pixel-minus-1/16 screen
shift. Guest programmable VS adaptation instead adds `(1,-1)*W/extent`.
Neither branch was changed or runtime-tested here.

Subtracting the required half-pixel center conversion leaves a geometry
translation of `(-e,-e)`, with `e=1/16`. In an unsnapped analytic rasterizer,
unchanged vertex attributes therefore evaluate at original screen position
`p+(e,e)`. This follows from translation invariance of barycentric coordinates;
it is not a measured statement about GPU snapping or the actual queue.

## Independent interpolation and coverage

For triangle vertices `(x_i,y_i)`, unmodified edge equations give screen
barycentrics `lambda_i(p)`. Coverage uses their signs and exact top-left ties;
interpolation uses their unbiased values. With input reciprocal W `q_i`:

```
Q(p) = sum(lambda_i(p) * q_i)
N_u(p) = sum(lambda_i(p) * q_i * u_i)
u(p) = N_u(p) / Q(p)
du/dx = (N_ux * Q - N_u * Qx) / Q^2
z_device(p) = sum(lambda_i(p) * z_device_i)
```

The oracle takes the integer pixel position directly. Its barycentric method
is cross-checked against an independent affine-plane solve. No geometry bias
is inserted into the expected values. Affine color is checked with constant
Q, avoiding an assumption about legacy color perspective policy. Smooth
perspective color is separately checked as the emitted GLSL transport model.
Device depth is affine in screen space, not another attribute divided by Q.

Hand-authored oblique triangle `(1,1),(9,1),(5,9)`, at integer center `(4,3)`:
`lambda=(1/2,1/4,1/4)`. For RHW `(1,1/2,1/4)` and UV `(0,0),(2,0),(0,4)`,
both U and V are `4/11`. Color `(0.2,0.6,1)` with constant Q is `0.5`;
smooth perspective color with the stated RHW is `19/55`. Depth
`(0.1,0.7,0.9)` is `0.45`.

| Interior attribute | Integer-center expected | Emitted-shift analytic result |
| --- | --- | --- |
| Perspective U | 0.363636363636 | 0.373563218391 |
| Affine color | 0.5 | 0.5078125 |
| Device depth | 0.45 | 0.45859375 |

Both sample locations are inside the triangle. These errors are independent
of shared-edge ownership. There are 69 interior sample positions on two
oblique triangles, cross-checking both UV planes, perspective color, and depth
transport. Fourteen shared-edge cases cover horizontal, vertical, both
diagonal slopes, oblique seams, and reversed windings. Every analytic pair
has exactly one owner.

The existing finite shift is not itself a general exact top-left rule.
For triangle `(0,0),(8,0),(0,8+1/32)`, `(4,4)` is strictly inside, but
`(4+1/16,4+1/16)` is outside. For edge `(0,0)->(8,8)`, the shift is tangential
and leaves its edge equation exactly zero. These are analytic counterexamples,
not claims of new observed GPU coverage failures. They rule out treating the
old axis-aligned source test as sufficient coverage acceptance for a repair.

## Retained public failure

The new sampler uses independently authored grid channels and explicit four
tensor-product weights. It imports neither the public oracle nor production
sampling code. At the public integer center `(2,3)`, the MIN LINEAR fixture
has U=`0.387`, V=`0.568`, LOD 1, and an 8x8 level. Its texel-space bilinear
fractions are `0.596` and `0.044`.

| MIN LINEAR model | RGB |
| --- | --- |
| Independent integer-center oracle | 113.752,42.28,103.404992 |
| Existing emitted translation, analytic only | 120.752,49.78,106.974992 |
| Original queued Worker WebGL1 readback | 121,50,107 |

All five retained observations match the displaced analytic prediction within
0.6 channel units. This narrows the hypothesis to a concrete emitted-source
interpolation defect and a matching explanation of the readback. It does not
uniquely prove that defect caused the runtime failure: there is no controlled
rendered repair experiment, and rasterizer quantization was not measured.
The original public failure, tolerance, queued path and oracle are preserved.

## Missing repair contract and validation

A defensible repair must decouple exact coverage ownership from attribute
evaluation. Removing the shift would change the known cockpit tile behavior;
correcting only texture UV would leave color/depth errors and potentially
perspective LOD errors. An arbitrary oblique edge cannot be represented by
one global translation that affects only ties.

An analytic correction, if retaining shifted geometry, must transport the
affine numerator AND reciprocal-W plane before division:

```
u(p) = (N_u(p+e) - e.x*N_ux - e.y*N_uy)
     / (Q(p+e)   - e.x*Qx   - e.y*Qy)
```

Device depth needs its own affine-plane transport. Subtracting first-order
derivatives of already divided UV is not exact; the focused test rejects
that shortcut on perspective data. These calculations do not establish a
portable shader implementation, clipping behavior, rasterizer snapping,
WebGL1 extension availability, corrected LOD derivatives, depth ordering,
or unchanged actual top-left ownership. Exact per-edge coverage and
unbiased interpolation, with those constraints, remain the missing shared
rasterization contract. No speculative production correction was made.

Commands executed:

```
node test/test-legacy-integer-center-interpolation.js --evidence=scratch/runs/20261104-legacy-public-mip-nonsolid-filter/browser/result.json
node test/test-legacy-integer-center-interpolation.js --require-integer-center
node test/test-d3d9-fixed-top-left-bias.js
node test/test-d3d9-fixed-plan-cache.js
node tools/test-tiers.js --check
flock /tmp/wine-build.lock bash tools/build.sh
```

The first command validates analytic controls and preserved evidence; it is
not a passing integer-center acceptance test. The second deliberately exits
1 at the current lowering's perspective-U mismatch. The ordinary diagnostic
explicitly characterizes the existing lowering; its bounded source recognizer
and displacement controls need updating with a repair. Top-left policy, plan
cache, tier membership and the serialized full build all pass. The passing
diagnostic controls and build do not close the failing acceptance gate.

Run: `scratch/runs/20261104-legacy-integer-center-interpolation/`. Exact source
SHA, relevant binary diff, owned new-file patches, first failing gate, results
and hashes are retained there; Git is the source archive. No source archives,
media copies, browser/game/large CLI runtime, box access, lifecycle actions,
subworkers, deployment or successor task. No box is assigned; ID/state/expiry
are not applicable. Coordinator retains all runtime ownership. Next required
work is an explicit coverage/interpolation implementation contract and its
rendered oblique shared-edge, perspective, depth and public queued regressions;
the remaining public spatial matrix is still unexecuted.
