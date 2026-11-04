# D3D7 generated normal coordinates survive colored FVF packing

2026-11-04. Starting main: `26101168e2426f8b50f0f5643b139116438367c7`.
Production claim base: `90010c302af7bad245b91290c61bb9f7382b683f` (intervening
changes were documentation). Evidence:
`scratch/runs/20261104-legacy-generated-coordinate-contract/`.

One demonstrated Device7 rendering defect is repaired. XYZ|NORMAL input with
DIFFUSE or SPECULAR was packed as a canonical D3DLVERTEX, which has colors in
place of the normal. Camera-space normal generation subsequently saw no normal
and retained the supplied UV. Uncolored input retained its normal and worked.
Lighting could also convert an initially uncolored vertex to the same layout.

## DX7 contract and bounds

Microsoft's September 2, 1999 DirectX 7 SDK, preserved by the Data Dungeon,
defines [generated coordinates](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_0zhg.content.htm)
as camera-space position, normal, or reflection input for texture processing.
Its [configuration contract](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_9n38.content.htm)
says generation replaces the supplied coordinates. The selector's low bits
still select wrapping state; they do not select a supplied texture set when
generation is enabled. The [processing path](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_1hyc.content.htm)
applies the texture matrix when transforms are enabled and defines the COUNT
output components. Its [usage example](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_82lg.content.htm)
explicitly maps camera-space XYZ to two texture coordinates with a matrix.
Reference URLs, byte sizes and original download SHA-256 values are retained
in `references.json` without a documentation archive.

These references justify generating the normal regardless of whether a vertex
also contains colors or unused texture sets. They do not justify assigning
D3D8/9 ProcessVertices output-allocation semantics to D3D7. This repair changes
Device7 direct/VB drawing, not ProcessVertices. There is no new capability bit,
cube-map support, generated projection qualification, or native Windows
conformance result.

## Failure established before the producer edit

The pre-edit normal module was
`4ddc8336097ef4b8503c6e6d2bb7fb05a2a1084800322523c8959b7128ca217a`.
`baseline-corrected-oracle/first-failure.json` records the successful public
DrawPrimitive7 and failed pixel: at (5,5), normal generation with DIFFUSE
produced `[55,56,123]`, the supplied-coordinate color, versus the independently
expected `[55,173,84]`. The same failure is preserved in all eight
`baseline-<vb>-<indexed>-<queued>.json` cells. Before that failure, camera-space
position and uncolored-normal cells passed through the same fixture.

An earlier `baseline/first-failure.json` had an arithmetic error in the authored
position UV list. It was corrected before any production edit. The corrected
position list is derived explicitly below and independently checked by the
Fraction audit; that initial oracle error is not counted as a production bug.

## Narrow repair

`src/09ab-handlers-d3dim-core.wat` is the current location of the shared legacy
conversion and generation helpers. The new bounded helper reads the original
XYZ|NORMAL prefix before its normal disappears from the colored layout. It
uses the existing legacy camera-normal/matrix calculation and writes only the
generated UV into the packed per-draw allocation. It runs for colored vertices
before the lighting gate, and after lighting converts an uncolored vertex.
The colored draw consumer retains that UV, avoiding a second texture transform.

The existing guards require a valid packed allocation, nonzero bounded count,
XYZ|NORMAL FVF and device state. The new helper additionally requires the
camera-space normal selector. It does not write the source allocation or change
position/color packing. Supplied selectors and XYZRHW return through the
existing paths. Queued commands capture the resulting TL values normally; no
queue format or consumer changes were needed.

## Independently expected pixels and actual public calls

`test/test-legacy-generated-coordinate-contract.js` is registered in the e2e
tier. Its shared fixture executes actual published x86 COM vtables on the normal
full module: DirectDrawCreateEx, QI to D3D7, CreateSurface/CreateDevice,
SetTransform/SetTextureStageState, direct/indexed drawing, CreateVertexBuffer7,
Lock/Unlock and VB drawing, and render-target Lock readback. Calls verify stack
cleanup. It does not replace a producer, renderer, or COM entrypoint.

The world rotates `(x,y,z)` to `(-y,x,z)` and translates
`(.25,-.5,.125)`. The view translates `(-.125,.25,.0625)`. Authored object
positions consequently become `(-1,1,.5)`, `(1,1,.5)`, `(-1,-1,.5)` in camera
space and cover the 32x32 target triangle. Normals undergo the rigid rotation
without either translation. NORMALIZENORMALS is explicitly disabled.
The texture matrix gives `u=.5*x+.125*z+.375` and
`v=.5*y+.25*z+.4375`. The varying normal z terms discriminate component loss.

The JS pixel oracle interpolates an independently authored UV list with
weights `(1-(px+py)/32, px/32, py/32)` and samples a unique-color 16x16 texture.
Samples remain within their texels under a 1/16-pixel displacement. Expected
plans are written before module execution. The separate `audit.py` derives the
UV again from rational source normals/positions, rigid rotation and the two
explicit texture equations, and checks every expected/actual pixel using Python
Fraction arithmetic. It also checks captured coordinates, successful public
draw calls and stack cleanup.

The final eight cells use direct/VB × ordinary/indexed × immediate/physical
native Worker queue. Each has 26 states: camera position and normal, no colors,
DIFFUSE, SPECULAR, both colors, wrapping selectors 0/7 (including an index
beyond the three supplied sets), disabled/ordinary COUNT2/3/4 normal transforms,
two material-driven lighting-conversion cases, and two XYZRHW generation/matrix
bypass neighbors. VB draws begin at nonzero index two and retain poisoned prefix
records. All cells use the same independently expected pixels.

* 208 successful public draws and 624 exact RGB pixels pass.
* 104 held type-3 records retain independently expected generated/selected UV
  and identical full bytes after world/view/texture, selector and flag changes,
  public VB Lock/overwrite/Unlock, direct source overwrite, and index overwrite.
  The physical Worker subsequently reproduces the original pixels with zero
  fallback. Record SHA/size and selected vertex fields are retained.
* Every draw preserves its original direct source and complete live VB before
  intentional reuse. Three successful-public-draw negative controls are rejected
  by the unchanged pixel oracle: zero normal bytes, identity texture matrix,
  and replacement of generation with supplied coordinates.
* The independent audit passes 624 pixels, 104 captured records and 7,096 public
  call/stack checks. The full serialized build passes. Focused existing tests
  pass: `test-d3d7-fvf-lighting.js`, `test-d3dim-texgen-camera-position.js`,
  `test-d3dim-v3-vertex-buffer-draw.js` (900 indexed pixels), and
  `test-d3dim-indexed-texture.js`.

Final normal module SHA-256:
`b8cc7f53b6ce1f3b98dc91136cf115967b8b46ae683dc4a280730a178d206aa8`.
The build also produced compatibility module
`afe7f7713a2528c8e3d1421bdd8b9c7bc0a4c4d01a257698ca3343e679e1a746`;
the new public pixel cells use the normal module only.

## Remaining prerequisites and recovery

The demonstrated fix is colored/lighting-converted normal-source preservation
on Device7 direct and VB software draws. Inverse-transpose behavior under
nonuniform scaling, normalized normals, reflection vectors, generated PROJECTED
interpolation, strided input and generated ProcessVertices output remain
unqualified. The next rendering investigation should first establish a separate
supported generated-state failure with an independent pixel contract, or obtain
native D3D7 ProcessVertices-to-Lock evidence before changing that producer.
Full27, physical GPU and application gameplay are separate work. The accepted
supplied-coordinate dimensional suites were not rerun.

Recovery uses Git revision plus relevant binary diff and small owned new-file
patches. Dependency/module/media paths, sizes and SHA values are recorded rather
than copied. Closed large JSON/logs are gzip compressed with a verified SHA
roundtrip. No source archive, module/media copy, Chrome, local game, remote
runtime/API/lifecycle action, deployment or subworker was used. No box was
assigned; runtime lifecycle ownership remains with the coordinator.
