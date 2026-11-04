# D3D7 generated normal/reflection PROJECTED interpolation

2026-11-04. Evidence: `scratch/runs/20261104-legacy-generated-normal-reflection-projected/`.
Starting revision is recorded in `start-sha.txt`, after position PROJECTED
repair `748e1a896`. This repairs one shared rational-interpolation defect for
generated normal/reflection coordinates. There is no capability-mask change.

## Contract and independent derivation

The September 2, 1999 Microsoft DX7 SDK describes
[camera-space generation](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_9n38.content.htm)
and the [texture-coordinate processing path](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_1hyc.content.htm).
Generated vectors replace supplied coordinates and enter the texture matrix;
PROJECTED uses the last counted output component as divisor. These primary
documents were read offline from retained predecessor output, with original
document hashes and event provenance in `primary-dx7.json`. No network lookup
was performed. Ordinary reflection-to-2D support and its geometric derivation
are established separately in
[the reflection contract](legacy-generated-reflection-contract-20261104.md).

For screen barycentrics b, geometric clip w and texture outputs U,V,Q, the
independently derived projective sample is
`u=sum(b*U/w)/sum(b*Q/w)`, `v=sum(b*V/w)/sum(b*Q/w)`.
This equation is a geometric derivation, not a quoted SDK formula or native
Windows observation. Interpolating already-divided U/Q,V/Q differs.

World maps object XYZ to `(-y+.25,x-.5,z+.125)`. View maps that to
`(-x-.125,-y+.25,z+.0625)`. Authored object positions produce camera positions
`(-1,1,1/2)`, `(5/4,5/4,5/8)`, `(-3/2,-3/2,3/4)`.
Projection has clip w=2z, giving independent geometric w `1,5/4,3/2` and screen
vertices `(0,0),(32,0),(0,32)`. Camera normals are
`(-4/5,3/5,0)`, `(-3/5,0,4/5)`, `(0,4/5,3/5)`.
Unit eye vectors and `R=2*(N.V)*N-V` yield reflection vectors
`(62/75,-34/75,1/3)`, `(38/75,2/3,41/75)`, `(-2/3,-2/15,11/15)`.

For generated vector (x,y,z), the nonidentity texture matrix gives
`U=x/4+z/8+1/2`, `V=y/4+z/4+3/8`,
`Q3=x/2-y/4+3z/4+3/4`, `Q4=3x/8-y/8+z/2+3/4`.
Unique 16x16 point-sampled texel colors discriminate the addressed texel.
Every generated sample distinguishes rational interpolation from early division
and stays in its texel under the established 1/16-pixel fill displacement.

## Distinct baseline and causal repair

Before production edits, sixteen successful public draws fail: eight
direct/VB × ordinary/indexed × immediate/physical Worker routes for each mode.
Normal PROJECTED at `(4,7)` returns `[55,30,201]` instead of `[185,82,19]`;
reflection at `(4,8)` returns `[107,82,201]` instead of `[107,69,136]`.
`baseline-distinct/` retains these failures, including eight physically delivered
held records after public live-state and source mutation. The independent
Fraction audit verifies that both wrong pixels match early division.

The first weaker matrix/sample selection passed; it is retained in `baseline/`
as harness-selection evidence, not defect evidence. `baseline-witness.log`
records rejection of that selection when it could not supply enough stable
discriminating samples. The stronger matrix and distinct failures preceded
every production edit.

`src/09ab-handlers-d3dim-core.wat` separates raw camera-space generation from
the ordinary matrix/division helper. Supported generated normal/reflection
PROJECTED FVF draws now preserve original XYZ|NORMAL-derived vectors in the
existing 40-byte type-5 records. This reads normals before color packing or
lighting can erase them. The existing extended consumer applies the texture
matrix and retains numerators and texture q through interpolation independently
of position rhw. Queue format, Worker endpoint and renderer libraries do not
change. Reflection retains the prior explicit NORMALIZENORMALS behavior.

The existing position PROJECTED branch, supplied-coordinate branch and XYZRHW
bypass remain in place. Strided normal/reflection generation stays on its
previous route. The new extended producer requires XYZ|NORMAL; unsupported
normal/reflection FVFs lacking NORMAL produce no extended draw rather than
reading color bytes as normals. The historical generated characterization
assertion reflects type 5 for supported sources and the missing-normal guard;
its pixels remain explicitly unqualified.

## Verification

`test/test-legacy-generated-normal-reflection-projected.js` reuses fixture
plumbing without running the accepted position PROJECTED suite. It executes
actual public x86 COM vtables for DD7/QI D3D7, surface/device creation,
transforms/stage/render states, direct/VB ordinary/indexed draws, VB Lock/Unlock
and target Lock pixel readback. Public calls verify stack cleanup.

* Eight routes each pass 23 draws and 69 exact RGB samples: 152 generated
  PROJECTED draws/456 pixels plus 32 bypass draws/96 pixels. Generated cases
  cover COUNT3/4, four diffuse/specular layouts, lighting conversion for both
  modes and doubled reflection normals with explicit normalization.
* All 92 held records retain identical complete bytes after public world,
  view, texture, selector and flag changes, direct/index overwrites and public
  VB Lock/overwrite/Unlock. The 76 projected records contain independently
  expected generated XYZ1 and geometric rhw. Physical native Worker delivery
  preserves the original pixels, with zero fallback.
* Thirteen successful-public-draw negative controls reject zero normals,
  identity texture matrix, supplied selection, constant texture q, lost z
  contributions and explicit per-vertex early division for both modes, plus
  normal selection in place of reflection. The two early-division negatives
  reproduce the exact distinct baseline pixels through public supplied inputs.
* `audit.py` independently uses Python Fraction to derive rigid transforms,
  unit eye vectors, reflection, geometric w, texture matrix outputs and texels.
  It verifies all 552 pixels, 92 records, 6,652 public-call/release records
  (6,604 explicit stack checks and 48 release summaries), sixteen baseline
  failures and the two exact early-division reproductions.
* Focused neighbors pass: D3D7 FVF lighting, camera-position texgen, v3 VB
  draws (900 indexed pixels), indexed texture and supplied FLOAT3/4
  `--offline` (nine cells). Sixteen ordinary normal/reflection smoke draws
  pass immediate and physical Worker colored/lighting cases; their 48 pixels
  are separate regression evidence. Four normal/reflection historical
  representation checks pass without claiming pixel correctness. The first
  characterization harness expected an empty array instead of an absent
  descriptor list; its assertion failure is retained separately.

The serialized `flock /tmp/wine-build.lock bash tools/build.sh` passes on the
final source (`build-publish.log`). An intervening build stopped on a concurrent
worker's new Deus observer census entry; that owner resolved its registration,
and the final build passed. This worker did not edit Deus files. The rebuilt
module hashes equal the modules already used by the passing focused tests.

The normal module used for all new pixels has SHA-256
`b70c420e0a29c8664df1c3ed8b8074b590c342ed2a60078172b30e90922800cf`.
The build-produced compatibility module has SHA-256
`4771c78ba2cc1b84875e1e90a743f7fa624975764607c3d86a516fbcd1cd5d00`;
new rendered qualification uses the normal module only. `input-references.json`
records module/dependency paths and hashes without copying modules or media.
Final new output is `final/`; `after/` is the earlier passing test run before
the explicit exact-baseline negative assertions were added.

## Boundary and recovery

This qualifies finite rigid world/view, unit normals or explicitly normalized
reflection normals, local-viewer TRUE, PROJECTED COUNT3/4, and ordinary 2D
triangle sampling on the tested software routes. COUNT2 shares the corrected
representation but has no new rendered qualification. Nonrigid/inverse-transpose
normals, zero/nonfinite vectors, local-viewer FALSE, clipping, strided generation,
native D3D7 ProcessVertices-to-Lock output, GPU, native Windows, full27 and
application gameplay remain outside this result. Native ProcessVertices evidence
or a separate supported rendering failure is the next prerequisite.

Recovery uses the exact Git revision, relevant binary diff and owned new-file
patches. Closed logs are gzip-compressed only after SHA roundtrip verification;
compressed originals remain. No source archives, module/media copies, browser,
game, remote API, allocation, subworker, deployment or lifecycle action was used.
No box was assigned: box ID, state and expiry are not applicable; the coordinator
retains lifecycle ownership.
