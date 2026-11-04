# DX7 normal scaling and public ProcessVertices, 2026-11-04

This closes a demonstrated post-view normalization omission in specular
lighting following fresh-device defaults commit `8e717c0aa6dee5570bde04633a4ca59680600415`.
It also records bounded nonuniform world-transform behavior for
`D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013`. It does not establish the exact
DX7 nonuniform world normal transport rule or native Windows/GPU/gameplay
conformance.

## Authority established before expectations

The original September 1999 DX7 SDK
[render-state reference](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_5fdw.content.htm)
defines NORMALIZENORMALS=143, default FALSE, and specifies normalization
after transformation to camera space. The
[diffuse model](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_1rj8.content.htm)
normalizes the light direction and conditionally normalizes N; the
[specular model](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_6muc.content.htm)
conditionally normalizes N and uses the normalized halfway vector and power.

These are retained, independently read bytes under
`scratch/runs/20261104-legacy-retained-specular-implementation/primary/`:

| File | SHA-256 |
| --- | --- |
| imref_5fdw.content.htm | 7bcb2f8393d9615e54150ac6c0fe2b79a5a849614a36de1eba3be51e08c97ff0 |
| imover_1rj8.content.htm | 597355b616c005d0c35e9aa39e77bdfab3d697bcf27dc0dd947f6bd899b8c7e9 |
| imover_6muc.content.htm | 1d26e32dfe0d8c5dea10e1a11ed97bdc3cb0e9ee3575d8a751288b01c61002d3 |
| imover_95ic.content.htm | c88862d052348cdae84039b212d3b093340d74e7b191ca7c573b352a920af003 |

There is a material limitation: the same SDK's
[lighting mathematics overview](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_95ic.content.htm)
describes inverse-world transformation of lights/camera into model space
and warns that nonuniform world or view scaling can produce inaccurate
lighting. Small original world/view/pipeline/normal-vector pages were also
retrieved and read; their paths, URLs and hashes are in `input-references.json`.
They did not resolve a unique scaled-normal algorithm. Later DX8/9 text is
not used to manufacture a DX7 inverse-transpose requirement.

Consequently, the uniform-view normalized-normal invariant is an SDK-backed
correctness assertion. The forward-world numerical comparisons below are
explicit implementation characterization. Rejecting an inverse-world
candidate proves discrimination between models, not that DX7 mandates the
selected model.

## Demonstrated defect and bounded repair

Actual lighting resides in `src/09ab-handlers-d3dim-core.wat`, function
`d3dim_d7_light_vertices`; the suggested `src/09ad-handlers-d3dim-lighting.wat`
does not exist. The existing implementation normalized the world normal,
then transformed it by view for specular without normalizing again.

Before edits, BOTH actual shipped modules passed identity, uniform and
nonuniform world scale, rigid rotation and translation controls against the
forward model. Both failed normalized uniform-half-view cases after
successful public Set/Get/ProcessVertices, complete source immutability and
destination/stack checks. An axial input normal `(0,0,-1)`, light direction
`(0,0,1)`, orthogonal viewer and power 2 should retain specular red 201.45
before quantization with normalization enabled. Both produced byte 50
instead of approximately 201: the camera normal remained length 0.5.
This counterexample uses uniform view scale and identity world, avoiding
the unresolved nonuniform-world rule.

The eleven-line repair normalizes the specular camera normal after view
transformation only when NORMALIZENORMALS is enabled. Zero-length normals
remain zero. The earlier world-space diffuse computation and world normal
transport remain unchanged. With normalization disabled, input lengths and
the measured scale effects remain observable.

## Same-worker public numerical test

`test/test-legacy-nonuniform-normal-lighting.js` reuses the existing x86 COM
fixture mechanics, with independent JS vector/dot/power arithmetic. No
producer lighting helper or source-derived expected bytes are called.
The normalized specular model is `N=unit((normal*world)*view)` and
`S=lightSpecular*max(0,min(1,dot(N,H)))^2`; the unnormalized and diffuse
scaled results are labeled characterization. Real-valued RGB allows one
byte for quantization. Alpha is unasserted.

Seventeen sequential cases cover normalization off/on, input normal lengths
1 and 0.5, uniform world half-scale, world scale `(2,1,0.5)`, uniform view
half-scale, combined world/view scales, rigid world/view rotations,
translation and final identity restoration. All device state is explicitly
set/read back per case; each negative gets a fresh Wasm/device instance.
The same-device final identity case checks stale-state leakage.

Representative first-vertex bytes for normal `(0.6,0,-0.8)` after repair,
identical in both variants:

| World / view | Normalize | Diffuse RGB | Specular RGB |
| --- | --- | --- | --- |
| identity / identity | off or on | 47,75,124 | 129,86,51 |
| uniform half / identity | off | 23,38,62 | 32,22,13 |
| uniform half / identity | on | 47,75,124 | 129,86,51 |
| nonuniform / identity | off | 23,38,62 | 32,22,13 |
| nonuniform / identity | on | 19,30,49 | 20,14,8 |
| identity / uniform half | off | 47,75,124 | 32,22,13 |
| identity / uniform half | on | 47,75,124 | 129,86,51 |

Each variant passes 971 guarded public calls across the positive cases.
The actual destination vertex-buffer ProcessVertices call uses source index
1 and destination index 2, followed by public Lock readback. Guards cover
zero count, source/destination bounds, null source, surrounding destination
bytes, complete unchanged source, matrix/material/light/state readbacks,
output guards, stdcall cleanup, stack guards, Unlock and Release.

Nine controls per variant reject stale expected RGB after changing
normalization in either direction, world scale, view scale, normal length
or rotation, and reject independent input-normalize, world-normalize-only
and inverse-world candidate models. Every rejection completes successful
public processing and source/Unlock/Release checks. In particular, the
world-normalize-only candidate detects the repaired omission.

## Validation and evidence

`flock /tmp/wine-build.lock bash tools/build.sh` passed. Focused regressions
passed: public directional specular, positional specular, point/spot,
fresh-device defaults, supported computed lighting, ProcessVertices computed
lighting, D3D7 FVF lighting, ProcessVertices, ProcessVertices fog and vertex fog.

Run: `scratch/runs/20261104-legacy-nonuniform-normal-lighting/`.
Baseline modules were canonical
`f1904a97d822d0a6c420eb59724622c64b70c1ba3be1fda2a439aa8e9c966aeb`
and compat `d7f4a3fbb2a088edeb97c2e1d756a115758c72eae31f0e7c1702cd3df23dbcbc`.
Repaired modules at the existing `build/wine-assembly{,.compat}.wasm` paths:
canonical `b74179b7570e3d9b87b088b53fb106aaba321cd6b256445bcbb362e634f1d1ea`,
compat `716275cc2d6dee5a00941c1686e0ccb69cd7411c423dac5e8506cb62226ff724`.
Baseline retained plans/readbacks used zero diffuse material/light; the
final test additionally asserts nonzero diffuse RGB. The specular invariant
and geometry are the same.

The run retains Git base SHA, relevant binary diff, owned new-file patches,
unique small logs and compressed JSON readbacks, primary/media/module path
and hash references, publication record and a full-SHA artifact seal. No
source snapshots, module/media copies or scratch/docs/test-binary archives
were created. No disk fixtures were generated by the in-memory COM tests.

Next: establish an exact DX7 scaled-world transport rule from stronger
primary evidence before changing that algorithm. Nonuniform view transport,
shear/singular matrices, positional lighting under scale, alpha and native
Windows/GPU/gameplay remain unqualified. Offline Node/Wasm only; box ID,
state and expiry are N/A. The coordinator owns future runtime and shutdown.
