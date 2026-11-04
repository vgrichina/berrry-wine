# D3D7 computed ProcessVertices lighting: offline contract prerequisite

2026-11-04. Run: `scratch/runs/20261104-legacy-processvertices-computed-lighting/`.

Computed-lighting coverage remains **unproved**. This task stops at the first
missing prerequisite permitted by its instructions: the retained offline
primary references do not specify the lighting equations and output alpha
needed to select independently calculated computed-color positives. No
ProcessVertices computed output was tested, no supported-path defect was
demonstrated, and no producer was claimed or changed. This is not a passing
computed-lighting implementation result.

The new test checks the public configuration prerequisite using both shipped
normal and compat modules. It does not rerun the prior texture or unlit
packing matrix from `476b46aaec4805169ed47bdba7a3f85d27750b93`.

## Established contract and exact missing requirement

The retained Microsoft DX7 SDK [Processing Vertices](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_3grp.content.htm)
and [ProcessVertices](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_43ac.content.htm) pages
in `scratch/runs/20261104-legacy-processed-texture-transform/` establish:

* D3DVOP_TRANSFORM is mandatory; D3DVOP_LIGHT requests lighting.
* Lighting requires a supplied vertex normal and compatible source/destination
  formats. Source XYZ and destination XYZRHW are the documented minimum.
* Processing occurs between unlocked buffers, with source data unchanged.
* Flags zero copy components unaffected by the operation; DONOTCOPYDATA leaves
  those components untouched.

The additional cached primary `dx7.html` in
`scratch/runs/20261020-d3d-state144-contract-oct20/` is the SDK
[D3DRENDERSTATETYPE reference](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_5fdw.content.htm). It establishes LIGHTING=137, AMBIENT=139,
COLORVERTEX=141, material-source states 145/147/148, and the distinction
between enabling per-vertex color and selecting a material source. It links
to `imref_192c.htm` for D3DMATERIALCOLORSOURCE, which is not retained here.
These are original Microsoft SDK texts served by an archival mirror, not
new official-site retrievals. Their exact paths and hashes are pinned in
`input-references.json`.

None of these retained pages defines the complete diffuse/emissive/ambient
equation, directional N dot L convention, output diffuse alpha, or numerical
conversion allowance. Before adding computed positives, retain primary DX7
documentation defining those rules and the material-source enumeration.
Then choose exact or safely separated quantization values; avoid assuming a
rounding rule. Even ambient/emissive RGB alone would not establish the full
expected destination color DWORD without the output-alpha rule.

The task requires offline operation and explicitly permits stopping when the
retained primary contract cannot support the semantics. No network retrieval
was made. Production code and existing helper-based lighting tests were read
for routing context; their current behavior was not promoted into a contract.
The public ProcessVertices producer currently packs source vertices and calls
`d3dim_prepare_draw_vertex`, while Device7 draws also use
`d3dim_d7_light_vertices`. That routing difference is a lead, not evidence of
a supported public-call failure and not justification for a repair.

## What actually passed

`test/test-legacy-processvertices-computed-lighting.js` uses the accepted
public-COM fixture bootstrap and replaces its draw loop. DirectDrawCreateEx,
QI D3D7, surface/device creation, Set/GetMaterial7, Set/GetLight7,
LightEnable/GetLightEnable and Set/GetRenderState execute real x86 public
vtable calls. No test-only producer export computes an output.

Each module passes 21 setup readbacks and 94 bounded, stack-checked calls.
Material readback preserves all 68 bytes, with distinct exactly representable
RGBA channels. Directional-light readback preserves all 104 bytes, including
distinct diffuse/ambient channels and direction `(0,0,-1)`. Enable transitions
are true/false/true; BOOL true is checked as nonzero. Explicit state roundtrips
include LIGHTING=true, ambient `0x003571a9`, COLORVERTEX=false/true, selectors
0/1/2 for diffuse/ambient/emissive, and disabled specular, fog and normalization.
Acceptance of selector integers proves storage/readback only.

Guarded input/output structs, immutable Set inputs, HRESULT zero, bounded
completion, exact stdcall cleanup, caller RET and both stack canaries pass.
Two controls change one supplied material/light float mantissa bit through a
successful public Set call; successful public Get then fails the unchanged
byte oracle. These discriminate setup readback, not computed lighting.

The separate Python audit reconstructs material/light bytes with struct
packing and independently checks state/enable sequences and call counts. It
also verifies that there are zero ProcessVertices calls. No vertex allocations,
FVF/normal offsets, source/destination indices, Lock/Unlock allocation guards,
computed alpha, normal transforms or specular outputs are covered by this run.
Missing-color defaults, Windows parity, GPU and gameplay remain untested.

## Verification and recovery

Focused test, independent setup audit, ordinary no-evidence test and serialized
`flock /tmp/wine-build.lock bash tools/build.sh` pass. The test uses the ordinary
unit-tier default; no census registration or production edit was necessary.
Evidence includes start/tested Git identities, relevant binary diff, owned
new-file patches and input path/SHA-256 pins. Git is the source archive; no
source tarball, module or media copy was made.

No Chrome, game, remote API, box, worker, deployment or lifecycle operation
occurred. Assigned box ID/state/expiry: NA; lifecycle stays with coordinator.
Next prerequisite: retain authoritative DX7 lighting/alpha/material-source
contract before choosing supported computed-color positives. This single
assignment stops at that documented prerequisite.
