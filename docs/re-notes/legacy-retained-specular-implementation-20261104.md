# D3D7 computed specular RGB

Run: `scratch/runs/20261104-legacy-retained-specular-implementation/`.
This implements the missing directional RGB path identified in
`D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013`, following the exact primary-page
prerequisite recorded by `0bd4cda9fcc641944b019e7ddc3a15f75355deaa`.

The primary page was available. Direct HTTP GET retrieved the
[original DX7 Specular Reflection Model wrapper](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_6muc.htm),
its [actual content frame](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_6muc.content.htm),
and all four referenced equation GIFs. Original bytes, URLs, lengths and SHA-256
are retained in `primary/manifest.json`; the wrapper/content HTTP headers are
also retained. The equation images were individually opened and visually
inspected. No SDK collection was downloaded.

The inspected images transcribe to:

```
LOCALVIEWER true:  H = norm(norm(VC) - Ld)
LOCALVIEWER false: H = norm(I - Ld), I = (0,0,-1)
Rs = (N . H)^p
Sv = Vs * A * Rs * Ls
```

`VC` points from vertex to eye; `Ld` points along light travel. Products in
the last equation are per color channel and contributions sum over enabled
lights. The implementation interprets clamped reflectance on the positive
half-angle domain: nonpositive `N.H` contributes zero, including even powers.
The test distinguishes facing, tangent, away and oblique normals; it does not
add a separate, undocumented `N.L` gate to specular.

The linked [D3DMATERIAL7 member documentation](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_49es.content.htm)
explicitly makes power zero disable highlights. This overrides algebraic
`x^0`; positive powers control sharpness. Setting the selected RGB to black
also makes its color product black. The broader material-properties matte
recipe asks for both zero power and black color; those are consistent gates.

The retained [render-state reference](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_5fdw.content.htm)
independently gates highlights with SPECULARENABLE (29), selects LOCALVIEWER
(142), and selects SPECULARMATERIALSOURCE (146). Its generic SPECULARENABLE
paragraph describes an object-origin approximation; the detailed DX7 model
explicitly defines per-vertex VC for LOCALVIEWER true, which is the rule used
here. COLORVERTEX (141) gates the selector. The linked
[color-source enum](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_192c.content.htm)
maps MATERIAL/COLOR1/COLOR2 to material/diffuse vertex/specular vertex.

The SDK [mathematics introduction](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_95ic.content.htm)
describes model-space calculations and warns about nonuniform scaling. This
bounded implementation uses camera-space specular vectors, preserving dot
products for rigid world/view transforms. It transforms positions with
translation and directions without translation. Orthogonal viewing uses the
camera's negative Z axis; local viewing normalizes the negative camera-space
vertex position. World and view rotations/translations are tested separately.
Nonuniform matrix conformance and default-state initialization are outside
this explicitly configured directional fixture. NORMALIZENORMALS is tested
with different input-normal lengths under rigid transforms.

## Observed failure and repair

Original shipped hashes were `4417305d70322467441aef51e888b0fe66451d9c60da0c734eeb23f5a22c0a6b`
and `07fb4e75d05177271097dcd67d84e2629272b50073074bbdea8825ce10b4ed34`.
Both successfully processed the public call but returned input specular RGB
`[0,255,0]`, `[0,0,255]`, `[255,0,0]`, instead of equation values approximately
`[201.45,135.15,79.05]`, `[128.928,86.496,50.592]`, `[0,0,0]`.
`before/` retains complete public readbacks and unchanged-source checks.

`src/09ab-handlers-d3dim-core.wat` now computes the specular sum alongside
existing D3D7 lighting, applies the selected specular color, and writes the
packed RGB. Disabled highlights produce black RGB. The existing alpha byte
handling is preserved by masking; no alpha semantics are inferred here.

A second discriminating input exposed early quantization when reusing the
existing material-color packer: tiny material floats multiplied by bright
light became zero. `material-float-before-*.json` records both failures.
Specular material floats now remain floats through multiplication and are
converted only at final output. Existing diffuse arithmetic is unchanged.
The old FVF regression's passthrough-RGB assertion was updated to the computed
disabled-specular RGB contract, without adding an alpha assertion.

## Verification and recovery

`test/test-legacy-public-specular-lighting.js` reuses public x86 COM setup,
ProcessVertices, Lock/Unlock, Set/Get state and guarded allocation mechanics
from the existing directional and point/spot fixtures. Its numerical oracle
is authored from the retained equations, without producer lighting, packing
or transform helpers. It checks specular RGB with a one-byte quantization
envelope because these pages do not specify a float-to-byte rounding rule.
Geometry and destination sentinels are exact. Diffuse RGBA and specular/fog
alpha are only observed. The unresolved alpha boundary from `0b27067a1`
is neither asserted nor presented as resolved.

The suite uses source index 1 and destination index 2, checks all source bytes
for immutability, checks destination prefix/suffix and invalid/zero operations,
and checks stack guards on every public COM call. RGB mismatch is deferred
until source Unlock/Release checks finish. Both shipped variants run all
positive cases and 13 successful state-changing negative controls, including
power change, power zero, specular disable/enable, viewer mode, source,
COLORVERTEX, normalization, light color/enable, direction and matrices.

Exact commands and outcomes are recorded in run logs and `result.json`.
Final results: 23 positive cases and 13 controls per shipped variant, with
1,289 guarded public calls per positive run. Existing public directional and
point/spot suites, FVF lighting, ProcessVertices, vertex fog, ProcessVertices
fog, public material/light setup, and dimensional ProcessVertices all passed.
The final serialized full build passed. An intermediate build caught one
surplus closing parenthesis during the material-float refinement; it was
corrected before the final build and checks (both logs are retained).
Recovery uses the recorded Git base plus `relevant.diff` and owned-new-file
patches, then `flock /tmp/wine-build.lock bash tools/build.sh`. Module paths
and hashes are references; no modules, media, source snapshots or archives
were copied. `artifact-seal.json` seals the small primary responses,
readbacks, patches and logs. `publication.json` records the published commit
and owned-blob comparison.

This closes the missing configured directional specular RGB implementation.
Native Windows/GPU comparison, nonuniform scaling, defaults, and output-alpha
qualification remain separate work. No runtime box was assigned or accessed:
box ID/state/expiry are not applicable; runtime lifecycle remains with the
coordinator.
