# Independent repaired POSITIONT source acceptance, 2026-10-23

Verdict: **REQUEST CHANGES** for the complete candidate
`931aff173131780f76d5116c4b53a181e2be2eab`, branch
`task/render-positiont-depth-repair-oct23`, relative to exact main
`bb9c496ed13095cc832fdf607f0937fb9c14b7de`. Independent strict-key
`ls-remote` matched both revisions. No production changes or integration.

## New admission gap: finite positive RHW reciprocal overflow

The repaired admission scans POSITIONT z but not RHW
(`lib/d3d-shader-ir.js`, `fixedPositionT`). A finite positive FLOAT4 RHW of
`1e-39` (stored f32 `1.0000002153053333e-39`) passes, with z=.5 and viewport
MinZ=0/MaxZ=1. The clip-space VS emitted by `d3d_fixed_compile_stages`
(`src/09aj-d3d-fixed.wat`, POSITIONT block around lines 517–539) computes
RCP(RHW), then multiplies the reconstructed position by that reciprocal.
The f32 reciprocal overflows. The software post-VS finite-position gate
(`src/09ah-d3d-software.wat:461`) drops these vertices. The established
screen-space path copies POSITIONT directly and retains the finite RHW for
varyings (`d3d_software_project` and clipping flag4); it draws successfully.

Minimal repro is `admission-controls.js` in the evidence directory. Use a 4x4
target, white 1x1 texture, red diffuse, FLOAT4 POSITIONT triangle
`(0,0,.5,rhw),(4,0,.5,rhw),(0,4,.5,rhw)`, stride40 with FLOAT4 diffuse at16
and FLOAT2 UV at32, MODULATE(texture,diffuse) RGB/alpha, LESS depth, clear1.
The fixture is otherwise identical to the accepted default depth control.
Both production software draws return1, and native shared admission succeeds.

| RHW | preserved software BGRA(1,1) / red pixels | shared BGRA(1,1) / red pixels |
|---|---|---|
| 1 (matching control) | 0,0,255,255 / 10 | 0,0,255,255 / 10 |
| 1e-39 (finite regression) | 0,0,255,255 / 10 | 0,0,0,255 / 0 |

This is observable software behavior regression relative to main, not a claim
about required hardware subnormal behavior or new GPU regression. Both paths
execute the actual production native fragments with the same f32 bytes.
The exploratory `edge-controls.js` equality oracle exits1 at RHW1e-39;
the bounded regression-confirmation oracle exits0 only when the matching
ordinary control and the exact red-versus-black regression are reproduced.
The exploratory sweep also recorded other RHWs; no acceptance is inferred
from equal empty images for zero, negative, NaN or infinite RHW.

Hand back for production repair: preserve existing software behavior or narrow
admission before allocation to exclude unsafe reconstruction, including this
finite RHW. Add this expected-pixel/fullframe case to ordinary acceptance.
Checking merely `Number.isFinite(rhw)` would still admit this repro. This
review does not prove a sufficient general numerical admission domain and
does not modify production or the candidate's ordinary test.

## Depth repair and consumer checks that did pass

The five ordinary expected-pixel/fullframe cases pass: default .5/0/1 shared;
.1 and .9 with [.2,.8] fallback; .25 and .75 with [.5,.5] fallback and opposite
depth decisions. The test asserts both expected BGRA and full framebuffer
equality. Exactly one descriptor allocation and one profile compilation occur
across the five cases; always-fallback would fail that assertion. Default
shared software use disables `fixedPrograms` with a throwing trap, and default
WebGL selection disables `fixedPlans.compile` with a throwing trap. Both pass,
using actual native flag4 bytes/embedded DEF. GPU recording asserts emitted
native-derived vertex/pixel source and a three-vertex draw; it executes no GLSL.
Expected nonblack pixels and the MUL-to-ADD rejecting control prevent treating
missing rendering as acceptance. Constant-bank poisoning and viewport DEF
rebinding remain meaningful. The viewport rebind now stays inside identity
depth, as required by the repaired profile.

The copied corrected depth oracle independently exits0 on this candidate.
Its rejecting old-candidate control substitutes exactly the old JS producer
and old native fixed fragment from 5eb16d60, pins both to their Git blobs,
logs old module49311866/69067B, and exits1 on wrong expected pixels, rather
than on a new admission assertion. All other materialized production inputs
are unchanged for that control. Original review6ab1cff6's depth finding is
therefore repaired, but complete candidate acceptance fails on the new edge.

Independent additional admission checks reject before allocation: all z
NaN/infinities/out-of-range, NaN/infinite/nonidentity viewport depth, short or
nonintegral strides, invalid POSITIONT offsets, partial last vertex, and an
indexed snapshot containing unused NaN depth. A backing Uint8Array view at
byteOffset3 with POSITIONT offset4 and stride44 admits valid data and detects
NaN in the final vertex, proving the scan honors both offsets. The direct
native export also rejects five nonfinite/equal depth descriptors. Existing
eleven unsupported-profile checks, missing-export fallback, ten native
profile rejects and four nonidentity-depth rejects pass in the ordinary test.

## Actual producer ranges, ownership and fallback interfaces

Reviewed diff is saved losslessly as `reviewed-diff.json`: all six production changes plus the
ordinary test relative to main, including the original shared-IR migration.
Inspected relevant paths in all four actual WAT fragments (IR, SIMD VM, software raster, fixed
compiler), the test bootstrap, JS IR projection/lowering, and actual host,
software, WebGL and queue consumer paths. The general fixed compiler itself
is unchanged relative to main; the new export validates its narrower fields
then delegates validation/emission/partial allocation cleanup.

Host `draw` in `lib/d3d9-host.js:1059` derives topology counts and validates
declaration/register/stream bindings. INDEX16 validates [min,min+num), rebases
indices by min and copies num vertices starting at min; INDEX32 validates
that interval then gathers referenced vertices, preserving order. Packed
streams use their bound stride, packed attributes add the stream slot offset,
and the completed exact-size Uint8Array is what admission scans. UP and buffer
StartVertex/BaseVertex adjustments are already reflected in bound pointers.
The scan covers all copied records, including unused INDEX16 records, so it
can conservatively fall back on an unused invalid z; it does not under-scan
the declared draw. Primitive counts, short vertex arrays, out-of-range
indices, other attribute widths and raster viewport extent still undergo
existing consumer validation. The admission helper alone is not a complete
public draw validator, and this review does not claim it is one. No new
range-validation gap was demonstrated in these unchanged paths.

Descriptor allocation happens after profile/depth scan. `finally` frees its
guest pointer and a returned bundle even on projection/read error. Bundle
reader checks bounds/profile/stages/origin and copies IR bytes; embedded DEF
records travel with them. Software copies these into draw-owned native memory
and compiles the VM; WebGL reparses copied native flag4 bytes through its
separate fixed-origin lowering. Guest-origin validation remains separate.
Queue serialization recursively copies typed-array bytes, and reserve charges
native bytes before publication. Queue pending/order/completion control passes.
The five ownership controls pass on success, descriptor allocation failure,
native compilation zero, bad bundle and postcompile read fault. Actual released
native IR storage is overwritten without changing packet bytes. No claim is
made about allocator reuse with the fixture's no-op frees.

Returning null retains backend-specific old fixed paths. In particular,
software's screen-depth behavior is preserved for the four repaired cases;
the pre-existing GPU fallback still reconstructs clip depth and is **not**
qualified as semantically equivalent to software for excluded depth ranges.
No new GPU pixel result or correction of those old fallback limitations.

## Checks, evidence and remaining qualification

Evidence directory: `scratch/runs/20261023-render-positiont-depth-independent-accept`.
`checks.json` records exact argv/exits/logs: ordinary0, corrected-depth0,
old-control1 EXPECTED, ownership0, exploratory-edges1 DEMONSTRATED FAILURE,
admission/regression-confirmation0. Prior unrelated source evidence from
review6ab1cff6 is reused; no broad prerequisite replay. All80 materialized
tracked candidate blobs, all21 repair seals and both sets of20 older evidence
seals verify. Exact old control producer blobs also verify. Input identity
and these counts are in `input-verification.json`.

Focused fragment module remains69097B, SHA256
`5b12ae64af023d0203a5498ff594eaa38d9f7d90b50046533934f784e4c46ed8`.
This is not the canonical full module. Before separate full qualification,
minimum inputs are: repaired/reviewed exact source revision; a normally built
canonical module with source/build/module SHA and layout provenance; real
allocator/COM-to-host producer fixtures for copied/indexed/multistream draw
ranges and allocation failures/heap reuse; authorized actual WebGL1/2 contexts
and driver compilation/pixel/readback evidence for admitted and fallback
cases, unequal RHW, depth/blend/top-left; matching expected pixels/fullframes
and rejecting controls including this finite RHW edge. Games/performance
remain separate. No rebuild/fullcompile, Boat/browser/runtime/media/install,
deployment/main integration, recovery, or workers were used in this review.
No box assigned; no box state or expiry probed; lifecycle stays coordinator-owned.

Before checkout, donor/copy inventory was measured, but **whole-local admission
was incomplete and failed when corrected**. The initial27069622B upper bound
included donor Git/source/tools/evidence, copied checkout,8MiB growth and8MiB
reserve, but mistakenly omitted the system Node executable used by the checks.
`/usr/local/bin/node` resolves to
`/home/user/.nvm/versions/node/v24.18.1/bin/node`,123656816B, exceeding the
67108864B cap alone. This was discovered after the checks, while reading the
other lane's board resource blocker. No further Node checks or alternate
runtime attempts were performed. The earlier preflight PASS claim is withdrawn;
retained observed behavior is **not resource-compliant acceptance evidence**.
`resource-accounting-correction.json` records the failure. A separately
coordinator-authorized resource budget is needed for compliant execution of
these exact controls; no such increase is assumed here. Host floor remained
satisfied. The source finding is still REQUEST CHANGES, with precise observed
repro, not an ACCEPT or full qualification claim.

`GIT_NO_LAZY_FETCH=1` throughout; no fetch/archive, root index or donor metadata
mutations. Publication preserves candidate paths using the full thin index
and `write-tree --missing-ok`/`commit-tree`. Review-only note/scripts/evidence
are added on the assigned branch. Exact commit/push verification and corrected
accounting are in postpublication `publication.json` and the append-only
shared messageboard. No merge authorized or performed.
