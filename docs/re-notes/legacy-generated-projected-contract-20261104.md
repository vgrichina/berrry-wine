# D3D7 generated camera-position PROJECTED interpolation

2026-11-04. Evidence: `scratch/runs/20261104-legacy-generated-projected-contract/`.
Starting revision is recorded in `start-sha.txt`, after published reflection
repair `14fe5e1a`. This closes one separate generated-coordinate rendering gap:
camera-space position PROJECTED draws interpolated already-divided vertex UV.
No capability bit changes.

## Primary DX7 contract and independent oracle

The September 2, 1999 Microsoft DX7 SDK describes
[camera-space generation](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_9n38.content.htm),
the [coordinate processing path](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_1hyc.content.htm),
and specifically a [camera-position PROJECTED COUNT3 example](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_82lg.content.htm).
Generated coordinates replace supplied sets and enter the texture matrix;
the last counted output component supplies the projective divisor. The
low selector bits choose wrapping state. Primary text was read offline from
the preceding worker's retained output; `primary-dx7.json` records its path,
SHA, original event provenance and original document download hashes.

The rational pixel oracle is independently derived projective geometry, not a
claim that the SDK prints this equation: for screen barycentrics b, position
clip w, texture matrix outputs U,V,Q, sample
`u=sum(b*U/w)/sum(b*Q/w)` and `v=sum(b*V/w)/sum(b*Q/w)`.
Interpolating U/Q and V/Q at vertices is distinguishable from this result.

World maps object XYZ to `(-y+.25,x-.5,z+.125)`. View rotates 180 degrees
about Z and translates `(-.125,.25,.0625)`. Authored object positions yield
camera positions `(-9/8,9/8,1/4)`, `(5/4,5/4,1/2)`,
`(-11/8,-11/8,3/4)`. Projection gives independent geometric w
`9/8,5/4,11/8`, retaining screen positions `(0,0),(32,0),(0,32)`.
The nonidentity texture matrix produces
`U=x/4+z/8+1/2`, `V=y/4+z/4+3/8`,
`Q3=x/8-y/16+z/2+3/4`, `Q4=x/16+z/4+7/8`.
Unique point-sampled texel RGB values detect the selected address exactly.

## Baseline and causal repair

Before any production edit, all eight direct/VB × ordinary/indexed ×
immediate/physical Worker routes successfully drew but returned
`[94,212,188]` at `(4,4)`, versus rationally expected `[94,199,123]`.
`baseline-corrected/` contains these failures and complete public-call evidence.
The initial harness had an oracle serialization ReferenceError; its files
are retained in `baseline/` and are not rendering failure evidence. The
`after/` attempt still used the old module while the locked build ran and is
also retained separately.

`src/09ab-handlers-d3dim-core.wat` now routes generated camera-space position
with valid PROJECTED COUNT2/3/4 flags through the existing 40-byte type-5
representation. It fills the four texture input components from original XYZ
through world and view, independently of supplied coordinates, colors and
lighting conversion. The established projected consumer applies the texture
matrix and retains U,V,Q through interpolation. The queue already copies the
complete extended vertices and matrix; no stream format, Worker endpoint,
renderer library or ProcessVertices producer changes were required.

Supplied selection retains its existing branch. The caller's XYZRHW bypass
still excludes this conversion. Normal and reflection generation retain their
existing paths, including their unqualified PROJECTED interpolation boundary.

## Public rendered verification

`test/test-legacy-generated-projected-contract.js` uses actual x86 COM vtables
for DD7/QI D3D7, surface/device creation, transforms/stage/render states,
direct and VB ordinary/indexed draws, VB Lock/Unlock and target Lock pixels.
Every public call checks stack cleanup. It reuses fixture plumbing without
rerunning the predecessor's normal/reflection positive suites as new evidence.

* Eight routes each pass 12 draws/36 exact RGB samples: 72 generated PROJECTED
  draws/216 pixels plus 24 supplied/XYZRHW bypass draws/72 pixels. Generated
  cases cover COUNT3/4, four color layouts and one lighting conversion.
* All 48 held records retain complete identical bytes after public world,
  view, texture, selector and flag changes, VB Lock/overwrite/Unlock, direct
  source overwrite and index overwrite. The 36 projected records carry the
  independently expected camera XYZ1 and geometric rhw. Physical native
  Worker delivery preserves original pixels; no fallback occurs.
* Five successful-public-draw negatives fail the unchanged pixel oracle:
  identity texture matrix, supplied selector, constant texture q, missing
  texture z contributions, and explicitly supplied per-vertex U/Q,V/Q with
  transformation disabled. The last reproduces the erroneous early-division
  model through real public draw inputs, returning the identical baseline
  pixel `[94,212,188]`.
* `audit.py` independently uses Python Fraction to derive both rigid
  transforms, geometric w, matrix outputs, rational interpolation and texels.
  It verifies 288 pixels, 48 records and 3,692 public-call records. Fifteen
  authored pixel samples distinguish early division. Samples stay inside
  their texels under the established 1/16-pixel fill displacement.
* The serialized `flock /tmp/wine-build.lock bash tools/build.sh` passes.
  Focused neighbors pass: `test-d3d7-fvf-lighting.js`,
  `test-d3dim-texgen-camera-position.js`, `test-d3dim-v3-vertex-buffer-draw.js`
  (900 indexed pixels), `test-d3dim-indexed-texture.js`, and
  `test-legacy-transformed-float34.js --offline` (nine cells, including supplied
  projected transforms and fault rejection). The historical generated
  characterization assertion now expects position type 5 and normal/reflection
  type 3; its six draws pass without claiming their pixels as new evidence.

Final new pixels use the normal module. `input-references.json` records its
SHA-256 and the compatibility build's hash, plus referenced fixture/Worker
dependencies and calc input; modules and media are not copied into evidence.
Normal module SHA-256:
`84057ee689bbd778023ec64f1f2f5ecbeef217095d3f19cd21ae8ec281d5c971`.
Compatibility build SHA-256:
`86343aa6a96856b7efbea59ef473cde43d4ae0a73b6ba1dc2fb5481bf65d9842`.
Final output is `final-causal/`. The earlier passing `final/` lacks the added
early-division negative; `final-with-early/` retained an inherited flag override
in that negative, which was removed before the final causal check.

## Remaining scope and recovery

This qualifies finite rigid world/view camera-position PROJECTED COUNT3/4
triangle sampling with independent position w and texture q. COUNT2 uses the
same corrected route but has no new rendered qualification here. Generated
normal/reflection PROJECTED, clipping, nonrigid transforms, strided inputs,
GPU, native Windows and native ProcessVertices-to-Lock behavior remain outside
this result. A separate supported generated normal/reflection PROJECTED
baseline or native ProcessVertices evidence is the next prerequisite.

Recovery records exact Git SHA, relevant binary diff and owned new-file
patches. Closed logs are gzip-compressed only after exact SHA roundtrip;
compressed originals remain available. No source archives, module/media
copies, browser, game, remote API, allocation, subworker or deployment was
used. No box was assigned; lifecycle ownership stays with the coordinator.
