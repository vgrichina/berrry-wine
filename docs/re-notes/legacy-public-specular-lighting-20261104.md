# Public D3D7 computed specular RGB: exact primary prerequisite

2026-11-04. Run: `scratch/runs/20261104-legacy-public-specular-lighting/`.
This bounded offline assignment stops at a concrete missing primary input.
No specular equation was invented, no production file was claimed or changed,
and `test/test-legacy-public-specular-lighting.js` was not created. No public
specular defect has been demonstrated by an independent RGB oracle here.

The existing producer explicitly says specular is uncomputed at
`src/09ab-handlers-d3dim-core.wat`, in the Device7 lighting stage comment.
That is implementation evidence of missing work, not authority for its
replacement. Existing public diffuse regressions cannot supply the missing
specular oracle.

## Exact missing input

The retained Microsoft DX7 SDK **Reflectance Model** page links directly to
[Specular Reflection Model](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_6muc.htm).
Its retained filename is `imover_4a78.content.htm`, under
`scratch/runs/20261104-legacy-supported-computed-lighting/primary/`, SHA-256
`1808599b97020132be3ec160ee5d664141c7b1e48cf819fdd90900e737529699`.
The retained Diffuse Reflection Model page also links to `imover_6muc.htm`.

The linked specular page's contents and equation images were not found in
the audited local evidence. This is an offline retention gap, not an HTTP
failure or a claim that the SDK lacks the page. No network request was made.
The exact `.htm` link is primary evidence; a `.content.htm` response and image
filenames must be recovered and verified, not assumed to have been read.

Required next input: retain that DX7 specular page and every equation image
it references, recording URL, original bytes and SHA-256. Establish the RGB
reflectance factor, light/material combination, exponent and zero-power rule,
viewer-vector direction and coordinate space, and any facing/backface gate.
Reconcile the model with the DX7 LOCALVIEWER and SPECULARENABLE state text
before selecting the first directional-light oracle. Endpoint-only geometry
would not resolve the power dependence requested by this assignment.

## What is already authoritative

All paths below are relative to the retained primary directory named above.
They were read locally and their bytes checked against its existing manifest.

| Page | SHA-256 | Relevant rule |
| --- | --- | --- |
| `imref_5fdw.content.htm` (render states) | `7bcb2f8393d9615e54150ac6c0fe2b79a5a849614a36de1eba3be51e08c97ff0` | SPECULARENABLE=29 enables highlights; Device7 default false. LOCALVIEWER=142 selects camera-relative versus orthogonal highlights; default true. SPECULARMATERIALSOURCE=146 selects the specular source; default COLOR2. |
| `imref_49es.content.htm` (D3DMATERIAL7) | `1e3fbf787f13bf8d2dbb08a6bd5a528ab127e67cfd87c94ac3ade8e6a994fe74` | Material specular is a color; power controls sharpness. Its member description explicitly prescribes power zero to turn highlights off and says zero color components alone are insufficient. This needs reconciliation with the exact model before implementation. |
| `imover_0w10.content.htm` (material properties) | `4674407b624e9e40c4a90e5c013f6eb48bd97bd325da3b1a29d636d925d0680a` | Larger power sharpens highlights; smaller power broadens them. Its matte recipe uses both power zero and black specular. No exact equation is supplied. |
| `imover_5des.content.htm` (per-vertex color) | `33134f6a7bb7e587d705e070c394be241c2ada05bab76830ed20164bd8044594` | COLORVERTEX gates per-vertex color selection; material-source selectors choose material, diffuse or specular input. |
| `imref_192c.content.htm` (D3DMATERIALCOLORSOURCE) | `23023ace4691e70611ef2b0b500b9cd94f1c2ed2d4eec838e19ec331377dbe58` | MATERIAL=0, COLOR1=1, COLOR2=2. |

The render-state page also describes highlights calculated as if vertices
were at the object's origin. That prose plus LOCALVIEWER's camera-relative
description does not specify the exact vector construction. A remembered
half-vector formula or a D3D9 producer implementation would not settle this
DX7 requirement.

## Audit and verification

`audit.py` checks the two retained lighting primary manifests (63 response
entries), pins their manifests and the public-fixture/module inputs, and
locally decompresses three previously archived DX7 reference records. Those
compressed records cover generated texture coordinates and contain no
`imover_6muc` reference. The checkout filename search found no `6muc` file.
This is the stated search scope; unrelated historical archives were not
exhaustively searched or unpacked. `primary-and-input-pins.json` records exact
paths, sizes, hashes and decoded hashes. No source/module/media copies or
archives were made.

Existing public computed-directional and point/spot suites pass both shipped
module variants. Their existing successful state-changing RGB controls pass.
FVF lighting, ordinary ProcessVertices, ProcessVertices fog and dimensional
ProcessVertices neighbors pass, as does the serialized full build. These are
baseline regression results, not specular acceptance or native Windows/GPU
results. The public suites already exercise nonzero indices, source
immutability and destination/stack guards; those mechanics were inspected for
future reuse. No new specular state/control was executed without its oracle.

Accepted alpha investigation `0b27067a178c12c1591234c7037fa881a5bdb738`
remains authoritative about the unresolved diffuse-alpha boundary. It was
not repeated. Fog/specular alpha and diffuse-alpha behavior are unchanged.

Evidence contains the tested Git SHA, relevant binary diff (empty for
production/test files), this owned new note as a patch, path/hash input pins,
authority audit and test/build logs. See `publication.json` for the actual
published note commit and `artifact-seal.json` for exact evidence hashes.
First prerequisite failure: missing retained DX7 Specular Reflection Model
equations, before a specular fixture or producer change. During run-script
development the pin audit first encountered the point/spot manifest's
different field names; normalization was corrected and the audit passed.
The first dimensional-neighbor invocation lacked its mandatory
`LEGACY_PV_EVIDENCE` environment variable and exited before running; the
corrected invocation retained its outputs under this run and passed.

Assigned box ID/state/expiry: NA. Offline only: no Chrome, game runtime, boat
API, box lifecycle, deployment or subworkers. Coordinator retains all future
runtime/shutdown ownership. Next: provide the retained exact primary page and
images above, then demonstrate the directional public COM defect before a
bounded producer correction and discriminating controls.
