# D3D7 camera-space reflection texture coordinates

2026-11-04. Starting main: `2b5b3b07ef308598fac0e9d65e3ab64e0bbe32cf`.
Evidence: `scratch/runs/20261104-legacy-generated-reflection-contract/`.
This closes a separate rendering gap after normal-source repair `8b00cdacc`:
reflection selector 3 previously returned supplied coordinates for every draw.
There is no new capability bit or cube-map allocation support.

## Primary contract and derivation

The Microsoft September 2, 1999 DX7 SDK's
[configuration description](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_9n38.content.htm)
defines camera-space reflection generation from vertex position and normal.
Generation replaces supplied coordinates; the selector's low bits choose wrap
state, including when they do not identify an available supplied set. The
[processing path](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_1hyc.content.htm)
and [usage examples](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_82lg.content.htm)
describe applying a texture matrix to generated camera-space XYZ to obtain
two-dimensional coordinates. Reflection generation therefore does not require
a cube texture: its vector can be input to an ordinary 2D texture transform.

The geometric oracle derives the mirror direction as `R=2*(N.V)*N-V`, with unit
camera normal N and unit vertex-to-camera vector V. This is an explicit geometric
derivation of reflection, not a quotation of an SDK equation or native Windows
measurement. Ordinary COUNT2/3/4 consume the transformed first two components;
disabled transformation consumes reflection x/y. No D3D8/9 ProcessVertices
semantics are imported.

This investigation was entirely offline. The primary documents were read from
the preceding worker's retained tool output, with its event-file path and SHA,
original document URLs, download sizes and SHA values recorded in
`retained-dx7-reference-text.json`. There was no fresh network lookup.

## Baseline and causal repair

Before editing production, the accepted normal module
`b8cc7f53b6ce1f3b98dc91136cf115967b8b46ae683dc4a280730a178d206aa8`
successfully executed DrawPrimitive7 but sampled RGB `[55,56,123]` at (4,4),
versus independently expected reflection RGB `[159,95,214]`. All four public
direct/VB ordinary/indexed immediate routes fail identically. Their four queued
neighbors successfully draw but fail the selected-UV assertion before delivery.
These eight failures are retained as `baseline-*.json`.

The initial manually authored reflection fractions contained arithmetic errors;
Python Fraction calculation corrected them before any renderer edit. The
initial log and `baseline-corrected/` are both retained; only the corrected
oracle is evidence of the production defect. After the repair, an extra supplied
FLOAT2 neighbor initially had an incorrect authored matrix expectation. That
case was removed from this bounded generation suite, and its `after-first/`
failure is retained. Final supplied neighbors check disabled-transform XYZ and
enabled-transform XYZRHW bypass. Existing supplied-transform tests were not
rerun or claimed as new work.

`src/09ab-handlers-d3dim-core.wat` now accepts generation mode 3, transforms the
normal and position into camera space, computes the unit eye vector and its
reflection, and feeds the existing generated-vector texture-matrix calculation.
Reflection honors explicit NORMALIZENORMALS. The original-normal preservation
helper also accepts mode 3, so DIFFUSE/SPECULAR packing and lighting conversion
cannot erase its input normal. It reads position directly from the original
XYZ prefix: projection scratch can belong to a different vertex when this
helper runs. The packed colored consumer retains the resulting UV without
applying the texture matrix twice.

The existing XYZ|NORMAL/count/allocation guards remain in place. Supplied
selector handling and the XYZRHW early bypass are not changed. No queue layout,
shader, renderer endpoint, ProcessVertices producer or Deus observer is edited.

## Public rendered verification

`test/test-legacy-generated-reflection-contract.js` reuses the public COM fixture
plumbing, not the predecessor's 208-draw normal suite. It dereferences real
published x86 COM vtables on the full normal module: DD7 creation, QI to D3D7,
surface/device creation, SetTransform/SetTextureStageState/SetRenderState,
ordinary/indexed direct and VB draws, VB creation/Lock/Unlock and target Lock
readback. Every recorded COM call checks stack cleanup.

World rotates `(x,y,z)` to `(-y,x,z)` and translates `(.25,-.5,.125)`.
View rotates 180 degrees about Z and translates `(-.125,.25,.0625)`.
The three object positions become `(-1,1,.5)`, `(1,1,.5)`, `(-1,-1,.5)` in
camera space; each has length 3/2. Camera normals are `(-4/5,3/5,0)`,
`(-3/5,0,4/5)`, `(0,4/5,3/5)`. Normal translations are excluded. The texture
matrix gives `u=Rx/2+Rz/8+3/8`, `v=Ry/2+Rz/4+7/16`. The varying reflection z
terms discriminate losing the third component.

The final eight cells are direct/VB × ordinary/indexed × immediate/physical
native Worker. Each has 18 reflection states: four color layouts, wrap selectors
0/7, disabled and ordinary COUNT2/3/4 transforms, two lighting conversions, and
two doubled-normal NORMALIZENORMALS cases. Three additional supplied/XYZRHW
bypass neighbors preserve the existing consumer boundaries. VB draws start at
index two with poisoned preceding records.

* 168 successful public draws and 504 exact RGB samples pass: 144 draws/432
  pixels exercise reflection calculation; 24 draws/72 pixels are bypass neighbors.
* 84 held type-3 records retain the independently expected selected UV and
  identical complete bytes after world/view/texture, selector and flag changes,
  public VB Lock/overwrite/Unlock, direct source overwrite and index overwrite.
  Physical Worker delivery reproduces the original pixels, with zero fallback.
* Six successful-public-draw negatives fail the unchanged pixel oracle:
  zero normals, identity texture matrix, supplied selector, normal generation
  instead of reflection, missing texture z contributions, and changed camera
  position. The camera negative compensates with projection translation so the
  screen geometry stays fixed.
* Independent `audit.py` recomputes both rigid transforms, unit eye vectors,
  reflection and UV with Python Fraction, then derives texels from rational
  barycentric weights. It verifies all 504 pixels, 84 records and 6,068 public
  call/stack checks. Samples are stable under 1/16-pixel displacement.
* The serialized full `flock /tmp/wine-build.lock bash tools/build.sh` passes.
  Focused neighbors pass: `test-d3d7-fvf-lighting.js`,
  `test-d3dim-texgen-camera-position.js`, `test-d3dim-v3-vertex-buffer-draw.js`
  (900 indexed pixels), and `test-d3dim-indexed-texture.js`. A separate four-draw
  predecessor normal smoke check passes immediate/queued colored and lighting
  cases; those 12 pixels are not counted as new reflection evidence.

Tested normal module SHA-256:
`06650eb0804c3c3c686ee638c61bc66e3ef8d08e74480750ebc0280ca3db1fa2`.
Build-produced compatibility module:
`62f299d07ddefa67c0fff4360d322f75153f2d42ac68130b85897c67c7085609`.
New reflection pixels use the normal module only.

## Remaining boundary and recovery

This qualifies ordinary reflection-to-2D sampling under finite rigid world/view
transforms, explicit local-viewer TRUE and unit or explicitly normalized normals.
It does not qualify inverse-transpose normals under nonuniform scale, zero-eye
or nonfinite vectors, local-viewer FALSE policy, generated PROJECTED rational
interpolation, strided reflection, native D3D7 ProcessVertices output, GPU,
Windows, full27 or application gameplay. The next rendering prerequisite is a
separate generated PROJECTED interpolation failure with an independent rational
oracle. Native ProcessVertices-to-Lock evidence remains a separate prerequisite
before changing that producer's generated-coordinate semantics.

Recovery records Git revision, relevant binary diff and owned new-file patches.
Module and dependency inputs are referenced by existing path/size/SHA, without
module/media copies or source archives. Closed large logs are compressed only
after exact SHA roundtrip verification. No Chrome, local game, remote API,
allocation, lifecycle action, deployment or subworker was used. No box was
assigned; runtime lifecycle ownership remains with the coordinator.
