# Independent POSITIONT numerical source acceptance, 2026-10-23

**ACCEPT scoped source/software behavior** of complete candidate
`5427a9e2e7d20984249cadcf67f1cb33cc9d85c0`, relative to
`931aff173131780f76d5116c4b53a181e2be2eab` and main
`bb9c496ed13095cc832fdf607f0937fb9c14b7de`. This is not merge or runtime
qualification. Strict dedicated-key remote lookup independently matched all
three revisions. No production changes in this review.

## Why this admission is sufficient for the software path

Reviewed actual `fixedPositionT` scan, fixed native POSITIONT emission,
SIMD VM execution, clipper, projector and interpolation/raster operations.
The only production change since931aff is the JS preallocation admission;
native compiler, profile guard, software raster and old fallbacks are unchanged.

Viewport integer origins [0,2048] and dimensions [1,2048] are exactly
representable in f32 and agree with descriptor conversion. These are profile
bounds, not complete draw validation: the software consumer additionally
requires the viewport fit its target (maximum2048). Coordinates are finite
because of their finite closed viewport bounds; z is in [0,1]. RHW must be a
positive power of two in [2^-16,2^16]. For f32 inputs, `Math.log2` cannot round
an adjacent non-power-of-two float to an integer here; adjacent-boundary rejects
also execute. Positive normal reciprocal W and recovered RHW are exact powers
of two. Components can underflow, so reciprocal bounds alone are not the proof.

Native `d3d_fixed_compile_stages` (09aj, POSITIONT block) emits f32 viewport
scale/bias DEF, RCP, MAD, MUL. The VM implements RCP by f32x4 division and MAD
as separate f32x4 MUL then ADD. JS uses matching `Math.fround` boundaries,
including bias products. Native projector (09ah `d3d_software_project`) divides
clip coordinates by W, applies viewport operations with the same individual
f32 roundings, and recovers reciprocal W. JS compares all recovered x/y/z/RHW
to the input. Identity depth means native multiply-by-one/add-zero does not
change ordered depth values; signed zero does not change coverage/depth tests.
Finite clip-component and all six plane inequalities are checked independently.

Exact vertex round trips alone would be insufficient. Here all vertices are
also inside every homogeneous plane with positive W, and user clipping is
excluded. The production clipper consequently copies original vertices without
constructing intersections or deleting homogeneous-zero vertices. It retains
triangle order/edge membership. Projected screen position, depth and reciprocal
W therefore reach the **same rasterizer** as the old screen-space path. Fixed
color/UV MOV outputs and their subsequent multiply by reciprocal W are unchanged;
interpolation uses the same f32 barycentric weights, interpolated reciprocal,
reciprocal multiplication, texture sampling, quantized depth and coverage rules.
There is no new JS interpolation implementation. Independent full-frame and
analytic controls below exercise this reasoning beyond the old constant-red
samples, including unequal extreme RHW, sloping depth and fractional edges.

## Draw ranges, ownership and fallback

Reused accepted unrelated source evidence from reviewd5ba96fc and its prior
review6ab1cff6, after verifying the unchanged materialized production blobs.
The host already applies StartVertex/BaseVertex/min-index offsets and copies
declared stream ranges into the exact packed snapshot; INDEX32 is gathered
into the existing INDEX16 consumer ABI. The helper scans every stride record,
using both Uint8Array byteOffset and POSITIONT attribute offset. It can reject
unused records conservatively; indices do not bypass scanning. Actual independent
INDEX16 draws with backing byteOffset3, POSITIONT offset4, stride44 and unused
first record pass; corrupting that unreferenced record rejects before allocation.
The inherited structural fixture also checks the final record and partial stride.
Existing consumer validation still rejects malformed ranges/counts/attributes.

All numerical fallback happens before `guest_alloc(288)` or native compilation.
The ten-control counters prove admitted draws still allocate/compile; independent
pixel tests additionally trap software `fixedPrograms` to disallow accidental
fallback. Native descriptor origin/stage validation, bundle copy/free/finally,
queue byte copying/order, separate guest/fixed lowering and backend selection
remain as previously accepted. Ordinary tests freshly exercise their relevant
copy/DEF/constant poisoning, selection and semantic rejecting controls. Retained
five ownership/fault modes and released-IR overwrite evidence is reused, not
misrepresented as real allocator reuse. Missing native export still falls back.

Moved-viewport correction is valid: vertices now lie inside the moved viewport,
so narrowing admission does not turn the rebinding control into an invalid draw.
Its changed native DEF/immutable prior IR assertions still run. A separate new
moved viewport test verifies every expected covered pixel, not just changed bytes.

## Executed evidence

Evidence: `scratch/runs/20261023-render-positiont-numerical-independent-review`.
`checks.json` records exact argv/exits and log names. Reproduce with installed
Node in place, from this checkout:

```
node test/test-d3d9-shared-positiont-ir.js
node test/test-d3d9-positiont-numerical-admission.js
node --require ./scratch/runs/20261023-render-positiont-rhw-admission-repair/candidate-preload.js test/test-d3d9-positiont-numerical-admission.js
node scratch/runs/20261023-render-positiont-numerical-independent-review/independent-pixels.js geometry
node scratch/runs/20261023-render-positiont-numerical-independent-review/independent-pixels.js interpolation
node scratch/runs/20261023-render-positiont-numerical-independent-review/independent-pixels.js layout
node scratch/runs/20261023-render-positiont-numerical-independent-review/independent-pixels.js texture
node scratch/runs/20261023-render-positiont-numerical-independent-review/independent-pixels.js boundary-x
node scratch/runs/20261023-render-positiont-numerical-independent-review/independent-pixels.js boundary-y
```

All final commands exit0 except the pinned931aff producer substitution, which
exits1 EXPECTED at `finite reciprocal overflow ordinary route nonblack pixel`:
actual black versus expected red, **before the new policy assertion**. Its RHW1
control passes first. Candidate producer SHA and native inputs are pinned.
Fresh numerical test: ten nonblack/10-red-pixel/full-frame controls and51
preallocation rejects pass. The exact finite RHW1e-39 repro now takes honest
fallback and draws the established ten red pixels. Ordinary corrected depth
cases, native selection, old MUL-to-ADD pixel rejection and DEF controls pass.

New independent script has28 admitted/full-frame cases:

- Geometry6: half/quarter fractional edges, thin triangle, reversed winding,
  degenerate and moved viewport; analytic per-pixel coverage.
- Interpolation8: three unequal-RHW RGB barycentric oracles (ordinary and both
  extreme orders), sloping depth on opposite sides of clear depth, exact
  subnormal depth, far/near equality rejection. Empty expected frames are
  negative depth/degenerate controls, not positive rendering evidence.
- Layout4: list/strip/fan alpha-blended shared diagonals (every square pixel
  exactly once) and unaligned INDEX16 source, plus unused-record preallocation
  rejection. Frontend-normalized ABI is INDEX16, not raw INDEX32 here.
- Texture6: three unequal-RHW2x2 nearest-sampled color oracles with white
  diffuse, and viewport widths1/3/8 with analytic coverage.
- Boundary4: actual2048x8 and8x2048 targets, dimension2048 and origin2044/end2048,
  exact analytic coverage for both axes. Origin2048 with positive dimensions
  cannot fit an established valid software target; it is only a descriptor
  domain boundary, not a newly qualified off-target draw.

Every final case requires non-null shared IR, actual native producer counters,
successful draws on both paths, full-frame equality and an independent pixel
or coverage oracle. Logs retain input IDs and framebuffer SHA256. All use the
actual four production fragments,69097B module SHA256
`5b12ae64af023d0203a5498ff594eaa38d9f7d90b50046533934f784e4c46ed8`,
exact8MiB fixture arena per process. No canonical/default compile occurred.

Intermediate fixture failures are retained: reversed winding initially moved
z=1 to the origin but expected a LESS-depth pass; raw Uint32 was rejected by
the existing INDEX16 interface; width2048 was initially attempted on8-wide
target, then target2052 hit the existing2048 maximum. These are equal-path
fixture errors, not production mismatches. Original scripts/logs remain, and
final cases use valid targets and explicit depth. Texture expected values were
strengthened from red diffuse masking to white diffuse/nonblack sampled color.

## Resource and pre-merge qualification

Measured manifest precedes checkout:4304571B materialized donor inputs/Git,
16MiB growth and8MiB reserve, upper29470395B inside64MiB; projected free
6545510725B exceeds2982150144B floor. Installed Node24.18.1 (123656816B),
Python/Git/SSH execute in place with standing identities/footprints separate.
Existing read-only donors are separately recorded. No tool copy/install,
symlink/hardlink accounting, broad fetch/archive or shared/donor index writes.
Input verification pins34 materialized source/tool/test blobs to5427a9e2;
all30 repair evidence seals independently match. Final resource and publication
receipts preserve measurements and actual remote commit verification.

Before merge, still qualify exact reviewed source through a canonical full
module with source/build/layout/module hashes; full COM-to-host declared draw
ranges, copied/indexed/multistream data and real allocator failure/reuse/lifetime;
actual WebGL1 and2 driver compile/link and pixel/full-frame/readback oracles
for admitted and fallback depth/RHW, unequal interpolation, clipping/top-left,
depth/blend, plus rejecting controls. Recording GPU calls produce no pixels.
No-op fixture frees prove no real heap reuse. The general native fixed compiler
and old GPU fallback depth limitations are unchanged and unqualified. No game,
performance, full-COM, canonical module or actual GPU acceptance claim.

No Boat/guest/browser/runtime/recovery/media/deployment/main integration or
workers. No assigned/contacted box; bx_fn7pn7yg was coordinator-reported
snapshot STOPPED (historical expiry03:46:00.580Z), not independently probed.
Coordinator retains lifecycle and decides the next task. Review worker stops.
