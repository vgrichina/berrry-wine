# Two fractional-colour precision boundaries

2026-11-04. Run: `scratch/runs/20261104-legacy-color-precision/`.
Predecessor publication: `82ba8f77e`. Production remains unchanged.

Both rejected-candidate outliers have numerical explanations. Neither
explanation establishes a required D3D7 intermediate precision or packing
rule. The concrete missing reference is an authoritative D3D7 contract for
clip-generated colour conversion, intermediate coordinate precision and
raster colour conversion, or a separately authorized pinned native D3D7
reference. This investigation was strictly offline; the retained references
do not establish those rules. No production repair is justified by this result
alone.

The primary `(16,4)` forward-order defect remains `[108,51,133]` against the
continuous homogeneous placement diagnostic `[104,51,131]`. This result does
not waive that defect or accept the predecessor candidate.

## Independent arithmetic

`test/test-legacy-color-precision.js` implements reduced BigInt rational
arithmetic, exact polygon/edge intersections, exact barycentric evaluation,
and binary32 round-to-nearest, ties-to-even by integer quotient/remainder.
There are no arithmetic epsilons or byte tolerances. It checks ties on both
sides of an even significand, signed values, subnormal ties, and 1,000
rational conversions against DataView storage. The reference never imports
production clipping, projection, colour, span, plane or sampler helpers.

Three distinct calculations are deliberately retained:

1. Exact geometry on authored decimal homogeneous coordinates, with explicitly
   chosen truncation of generated vertex channels.
2. Exact barycentrics on binary32-stored projected TL coordinates.
3. Labelled arithmetic experiments for the edges' stored reciprocal/depth
   representation, recording every exact pre-rounding value and binary32
   result. This explains an implementation dataflow; it is **not an output
   oracle or a D3D contract**. No production output is accepted by comparing
   it with this experiment.

The public harness is reused solely for x86 COM Draw/Lock, physical Worker
transport and state capture. Its older floating reference is recorded as
characterization, never used to accept observed colour bytes here. Exact
arithmetic assertions and public transport assertions remain separate.

## Authored and stored geometry

Screen-authored A/B/C are `(0,0)/(32,0)/(0,32)`, viewport scale/origin 16,
projection `w=1+z/2`. In homogeneous coordinates:

| Case | A | B | C |
| --- | --- | --- | --- |
| near | `(-3/4,3/4,-1/2,3/4)` | `(7/5,7/5,4/5,7/5)` | `(-13/10,-13/10,3/5,13/10)` |
| far | `(-1,1,0,1)` | `(3,3,4,3)` | `(-1,-1,0,1)` |

The guest stores x/y/z in binary32 before applying its binary32 projection.
For the near inputs, `7/5 -> 0x3fb33333`, `4/5 -> 0x3f4ccccd`,
`13/10 -> 0x3fa66666`, and `3/5 -> 0x3f19999a`; the A coordinates are exact.
The new JSON records signed coordinates, fractions and bits. The captured
Worker records' z/w and 1/w are checked against exact rational division with
independent binary32 rounding, with equality rather than an epsilon.

This distinction matters even before rasterization: exact clipping on stored
near guest inputs yields first-intersection red 95, whereas exact clipping on
authored decimal geometry yields 96. Binary32 operations between these points
can round a value back to an integer. An ideal-real byte cannot be made an API
requirement merely by calling its arithmetic more accurate.

## Cyclic near: stored placement crosses the red integer

Order `[1,2,0]`, z `[-.5,.8,.6]`, geometric w varying. At `(16,4)` the selected
exact fan is R/B/C with screen positions `(224/13,0)/(32,0)/(0,32)` and RGB
`[96,44,116]/[224,40,176]/[64,128,224]`. R is the near intersection with
homogeneous position `(1/13,1,0,1)`. Its exact A-to-B clip fraction is `5/13`;
the truncating colour convention gives R's listed bytes and fog byte 68.

Exact barycentrics are `[13/16,1/16,1/8]`; RGB before conversion is
`[100,217/4,533/4]`. Storing R.x as binary32 instead gives
`4516943/262144 = 17.230770111083984` (`0x4189d89e`). B/C remain exact.
Exact barycentrics on those stored coordinates are
`[1048576/1290555,645277/10324440,1/8]`. Red becomes
`129055492/1290555 = 99.99999380111657`; truncation gives 99.

The near arithmetic trace independently reaches that same R.x from rounded
guest/projection inputs: recovered distances are `-1/2` and
`13421773/16777216`; their difference rounds to `-5452595/4194304`;
t rounds to `12905551/33554432` (`3ec4ec4f`). Recovered endpoint w values
are `3/4` and `11744051/8388608`; generated w rounds to 1. The homogeneous
x difference rounds to `4508877/2097152`, its product to `3468367/4194304`,
and the sum to `322639/4194304`. Multiplication by 16 and addition of 16
give the stored R.x above. Red's pre-rounding product is
`167772163/2097152`, which rounds to exactly 80; adding 16 gives 96.
Green, blue, alpha and fog intermediates are all in the trace, yielding packed
`[96,44,116,255]` and fog 68. These diagnostic operations also explain why
the stored-input/exact-clip alternative's red 95 is not interchangeable.
Endpoint screen coordinates are exactly 0/32, so their inverse viewport
normalizations are exactly -1/+1; multiplying by recovered w supplies the
homogeneous endpoints used in the trace. Identity matrix terms and zeros
introduce no additional rounding for these coordinates.

Moving only R.x down one binary32 step gives `9033885/524288`, red
`774333156/7743331 = 100.00000723202973`, hence 100. Moving it up one step
gives red `774332748/7743329 = 99.99998037019995`, hence 99. The test retains
all three and four neighboring pixels. This explains why bypassing clipping
with explicit TL still leaves the candidate at 99: TL storage alone suffices.
It does not require a packing bias, a coverage change or a tolerance.

## Integral far: reciprocal/depth reconstruction changes a clip byte

Order `[0,2,1]`, z `[0,4,0]`. Exact far clipping of edge B-to-A gives
`t=1/2`, homogeneous `(1,2,2,2)`, screen `(24,0)`, RGB `[120,44,128]`,
fog 80. The selected exact fan at `(5,6)` has barycentrics
`[5/24,29/48,3/16]`; RGB is `[140/3,373/6,117]` before truncation.

The following independent IEEE calculation starts from storing B.sz=4/3 and
B.rhw=1/3. RN means one binary32 ties-to-even operation:

| Checkpoint | Exact stored result | Bits |
| --- | --- | --- |
| RN(4/3) | `11184811/8388608` | `3faaaaab` |
| RN(1/3) | `11184811/33554432` | `3eaaaaab` |
| RN(1 - sz) | `-2796203/8388608` | `beaaaaac` |
| RN((1 - sz)/rhw) | `-8388609/8388608` | `bf800001` |
| RN(distance - 1) | `-2` (exact midpoint rounds even) | `c0000000` |
| RN(distance / -2) | `8388609/16777216` | `3f000001` |
| RN(-96 * t) | `-6291457/131072` | `c2400002` |
| RN(176 + product) | `16777215/131072` | `42ffffff` |

The last value is `127.99999237060547`, which truncates to blue 127. Holding
all ideal geometry and other bytes fixed and changing only that byte gives
blue `2803/24 = 116.79166666666667` at `(5,6)`, hence 116. This isolates
the clip-byte cause independently of any raster plane implementation.

The full edge experiment also gives red `119.99998474121094 -> 119`,
fog `79.99999237060547 -> 79`, w `16777215/8388608`, rhw
`8388609/16777216`, screen x `12582911/524288 = 23.999998092651367`, y 0.
All pre-rounding products, additions and projection quotients are retained
in `exact-reference.json`. In the opposite edge direction, the denominator
rounds to +2 and t to exactly 1/2. This accounts for the winding discriminator;
it supplies no general winding-invariance guarantee.

Explicit ideal TL supplies `[120,44,128]` directly and avoids the reconstructed
clip fraction. That explains why the historical candidate's far XYZ blue was
116 while its explicit-TL blue was 117. Changing raster packing cannot recover
an already-lost intersection byte without changing another convention.

## Public evidence and scope

The predecessor's four retained precision-isolation logs were decoded in place
and hashed, including their candidate module identities. Both candidate modules,
immediate and physical Worker, report cyclic XYZ/TL `[99,54,133]` and far
XYZ `[46,62,116]` versus TL `[46,62,117]`. These are historical observations,
not fresh executions of a candidate. Its source patch remains recoverable at
`scratch/runs/20261104-legacy-fractional-color/candidate-undivided-f32.diff.patch`;
no candidate was reapplied, compiled or copied in this run.

Fresh tests use the accepted production modules. Thirty scenes per route cover
both boundaries and the primary forward witness, each with four neighbors,
constant/varying diffuse, constant/varying fog, exact authored explicit TL,
distinct texture Q and real alpha test. The full predecessor plan additionally
covers all three orders, unit/varying w, near/far controls and 180 scenes.
Both modules exercise ordinary/indexed immediate/physical Worker routes;
complete targets match between all routes and modules. Captured hashes remain
unchanged after live state/source/index mutation; fallback count is zero.

Fresh production differs from the rejected candidate, as expected: cyclic
XYZ/TL is `[100,53,133]`, far XYZ `[45,62,116]` versus TL `[46,62,116]`, and
primary XYZ/TL `[108,51,133]`. These results are explicitly characterization,
not precision conformance. Constants are exactly `[64,96,128]` without fog;
constant fog gives `[131,61,184]`. Q controls retain identical complete targets.
The far alpha control reveals the occluder `[49,70,91]`. Varying fog retains
the documented XYZ/TL differences; no exact equivalence is asserted for it.

The predecessor cites Microsoft Gouraud/subpixel-colour placement, specular-alpha
fog and packed D3DCOLOR documentation. Those citations describe placement and
representation; their retained content does not specify which of the rounding
sequences above is mandatory. This offline run makes no new claim about those
pages and no required clip-byte packing claim. In particular, binary32 guest
storage is established by authored bytes and captured state; binary32 at every
intermediate D3D7 hardware stage is **not** established by an API contract.

## Validation and disposition

The new exact test, both modules' four-route controls, full fractional-colour
characterization, accepted texture/clipped-depth/variable-Q/fog regressions,
indexed texture, vertex fog and shared Worker neighbors, and locked full build
are recorded in the run. The strict old colour oracle continues to reject the
primary defect. No tolerance, epsilon, coverage or production rule was changed.

Git SHA plus relevant binary diff and new-file patches are the recovery record.
Existing modules/media are referenced only by path and SHA-256; no snapshots,
tars, source/module/media copies, npm, Chrome, games, heavy-runtime lock, boats,
native Windows D3D7, subworkers or deployment were used.

Next: obtain the named authoritative precision/conversion reference (or separate
authorization for a pinned native D3D7 reference) before accepting or revising
the candidate. No broad GPU/caps/gameplay claim follows from these controls.
Box ID/state/expiry: not applicable; coordinator retains shutdown ownership.
