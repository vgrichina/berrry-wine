# DX7 computed diffuse alpha: exact unresolved authority boundary

2026-11-04. Run: `scratch/runs/20261104-legacy-computed-alpha-contract/`.
This bounded offline investigation ends at the permitted authority boundary.
The retained primary DX7 material-source rules are concrete, but they do not
explicitly connect the selected source's alpha to the **computed diffuse
output alpha**. No supported defect was demonstrated. No producer was changed
and `test/test-legacy-computed-alpha-contract.js` was deliberately not created:
there is no independently supported expected alpha to assert.

This is an unresolved contract result, not full RGBA coverage. The existing
[computed RGB](legacy-supported-computed-lighting-20261104.md) and
[point/spot RGB](legacy-point-spot-public-lighting-20261104.md) results stand.

## Retained authority and its limits

Read the two preceding notes, their tests, and the retained original Microsoft
DX7 SDK pages served by the archival mirror. No network retrieval was made.
`primary-pins.json` references 67 entries from the two preceding primary
manifests and the earlier retained alpha-state investigation, with existing
paths, exact URLs, byte lengths and SHA-256 hashes. Original response bytes
remain at those existing paths; none were copied into this run.
`authority-excerpts.json` records the relevant lines and source identities.

The central sources, under
`scratch/runs/20261104-legacy-supported-computed-lighting/primary/`, are:

| Primary DX7 source | SHA-256 | Established rule / remaining limit |
| --- | --- | --- |
| [D3DMATERIALCOLORSOURCE](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_192c.content.htm) | `23023ace4691e70611ef2b0b500b9cd94f1c2ed2d4eec838e19ec331377dbe58` | MATERIAL=0, COLOR1=1, COLOR2=2 select current material, vertex diffuse, vertex specular. No computed-output alpha equation. |
| [Render states](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_5fdw.content.htm) | `7bcb2f8393d9615e54150ac6c0fe2b79a5a849614a36de1eba3be51e08c97ff0` | DIFFUSEMATERIALSOURCE applies only with COLORVERTEX=true. Default is COLOR1. LIGHTING enables/disables lighting. No resulting alpha provenance stated. |
| [Per-vertex Color States](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_5des.content.htm) | `33134f6a7bb7e587d705e070c394be241c2ada05bab76830ed20164bd8044594` | Vertex colors can supply material components for lighting. Does not define their alpha's path to the output. |
| [Diffuse Reflection Model](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_1rj8.content.htm) | `597355b616c005d0c35e9aa39e77bdfab3d697bcf27dc0dd947f6bd899b8c7e9` | Ambient/emissive/diffuse equation and selectors support RGB. No separate alpha equation. |
| [Material Properties](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_0w10.content.htm) | `4674407b624e9e40c4a90e5c013f6eb48bd97bd325da3b1a29d636d925d0680a` | Material properties carry RGBA blending information; emissive text also mentions transparency. Does not state which alpha survives lighting. |
| [Color Values for Lights and Materials](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_8wbo.content.htm) | `134808ba0945a3823c2745f5acc31df258173dececbcf441db4961e2cb68c245` | Lights do not use alpha. That fact does not determine the output alpha. |

D3DMATERIAL7, D3DCOLORVALUE, D3DCOLOR, Processing Vertices,
ProcessVertices, Alpha-Blending States and Alpha Texture Blending were also
checked. Field definitions and later pixel blending do not supply the missing
lighting-stage equation. The retained October 28 DX7 alpha title-search result
lists texture, blend and test topics; it is not a complete SDK full-text search
and does not prove that the needed document does not exist. No complete DX7 SDK
documentation archive was located in the searched repository scratch paths.
No archives were unpacked. DX6 rules, D3D9 rules and current producer behavior
were not substituted for DX7 authority.

The precise missing proposition is the source and computation of the alpha
byte written to a DIFFUSE destination by D3D7 ProcessVertices with
TRANSFORM|LIGHT and LIGHTING=true. In particular:

| Explicit state | What remains unsupported |
| --- | --- |
| COLORVERTEX=false, each selector 0/1/2 | Whether output alpha is material diffuse alpha, independently of selectors, and whether other material alpha contributes. |
| COLORVERTEX=true, DIFFUSEMATERIALSOURCE=MATERIAL | Whether output alpha copies material diffuse alpha or follows another equation. |
| COLORVERTEX=true, DIFFUSEMATERIALSOURCE=COLOR1 | Whether input diffuse alpha supplies output alpha. |
| COLORVERTEX=true, DIFFUSEMATERIALSOURCE=COLOR2 | Whether input specular alpha supplies output **diffuse** alpha. This is distinct from output specular alpha's fog role. |
| LIGHTING=false or LIGHT omitted | The corresponding bypass/copy behavior needed for state-changing alpha controls. |

An explicit DX7 statement resolving these rows is needed before selecting
expected RGBA bytes. If non-endpoint material alpha is used, float-to-byte
conversion needs its own support or inputs whose permitted conversions agree.
The exact missing document title/URL is unknown; the links above are inspected
sources, not claims that an unretained page contains the answer.

## Why the existing tests cannot close this boundary

The existing public tests execute actual x86 COM ProcessVertices and Lock in
both shipped variants, with nonzero source/destination indices, immutable
source allocations, destination sentinels, HRESULT/stdcall and stack guards.
Their expected records explicitly exclude output alpha from acceptance.
The independent `audit.py` here checks the input and output evidence directly:
all 42 positive output allocations (126 vertices) use material diffuse alpha
1 and alpha 255 for every present COLOR1/COLOR2. All 126 observed output alpha
bytes are 255. These inputs cannot distinguish material-only, selected-source
or constant-opaque alpha hypotheses. The observed 255 values are not oracles.

`test/test-d3d7-fvf-lighting.js` does distinguish material and COLOR1 alpha in
its helper-based checks. It inserts test exports and directly calls the
lighting helper; its alpha expectations have no primary DX7 citation.
It remains useful as a neighboring implementation regression, but neither
its comments nor its successful run supplies missing primary authority.
The current producer passes the selected diffuse color's alpha to its packer
(`d3dim_d7_light_vertices` in `src/09ab-handlers-d3dim-core.wat`). That is an
implementation observation only. It provides no reason to repair or certify
the behavior. No peer guest-worker, cache or driver file was edited.

## Verification and recovery

The following existing tests pass in this run:

- Public supported computed RGB: both variants, nine cases each; five
  successful state-changing RGB controls rejected by the unchanged oracle.
- Public point/spot RGB: both variants, twelve cases each; seventeen
  successful state-changing RGB controls per variant rejected.
- D3D7 FVF lighting, ProcessVertices fog, and dimensional ProcessVertices
  (inline/queued and indexed/nonindexed, with four semantic controls).
- Retained-source hash/input-discrimination audit and serialized
  `flock /tmp/wine-build.lock bash tools/build.sh`.

The first dimensional invocation omitted its required LEGACY_PV_EVIDENCE
variable and failed before execution. The corrected invocation passes;
both logs are retained. These are neighboring regression results, not new
alpha acceptance cases or native Windows/GPU parity.

Input main is `d5f03571b1a6b35fb233b27f3159c2f05c72ff1d`;
entry HEAD was `7a9fac338882b23a6b9fde7b12cffda1fa0fa259`.
Validation HEAD is recorded in `identities.json` (peer documentation advanced
main). Tested module identities, unchanged across the build:

| Existing module path | SHA-256 |
| --- | --- |
| `build/wine-assembly.wasm` | `4417305d70322467441aef51e888b0fe66451d9c60da0c734eeb23f5a22c0a6b` |
| `build/wine-assembly.compat.wasm` | `07fb4e75d05177271097dcd67d84e2629272b50073074bbdea8825ce10b4ed34` |

The run retains exact Git identities, relevant binary diff, this owned new
document's patch, input path/hash pins, unique test logs/readbacks and a hash
seal. Git is the source archive. No source snapshots, archives, module/media
copies or repeated setup-only acceptance test were created. Existing calc.exe
is referenced by path/hash in `identities.json`.

The task stops at this exact unresolved authority boundary. The next required
input is primary DX7 computed-output-alpha authority, not another run of the
same nondiscriminating inputs. Offline operation was preserved: no Chrome,
game, boat API/allocation/lifecycle, subworker, deployment or approvals.
Assigned box ID/state/expiry: NA. Future runtime and shutdown remain owned by
the coordinator.
