# D3D7 material alpha after e541f978: prerequisite still unresolved

2026-11-04. Run: `scratch/runs/20261104-legacy-material-alpha-lighting/`.

**Stopped at the requested primary-authority gate.** The retained DX7 pages
establish material-source selection and COLORVERTEX, but do not specify the
computed diffuse output-alpha equation. No independently supported alpha
expected values were selected, no new public alpha comparison was executed,
and no defect or released-source repair is claimed. The assigned
`test/test-legacy-material-alpha-lighting.js` was deliberately not created.

This is a concrete prerequisite blocker, not closure of the alpha gap. The
[earlier authority boundary](legacy-computed-alpha-contract-20261104.md)
remains in force. This follow-up verifies that boundary against retained bytes
and the current public production path after
`e541f9781217ae244c2febd218502a37d0b29761`; it does not repeat nonuniform-world
research or a broad lighting sweep.

The current rules supported by the retained original Microsoft DX7 SDK pages
are:

| Retained page | Supported rule | Missing proposition |
| --- | --- | --- |
| `imref_192c.content.htm`, D3DMATERIALCOLORSOURCE | MATERIAL=0 selects current material; COLOR1=1 selects diffuse vertex color; COLOR2=2 selects specular vertex color. | Which selected alpha becomes computed **diffuse output** alpha. |
| `imref_5fdw.content.htm`, render states, lines 415–447 | COLORVERTEX enables per-vertex color in lighting; DIFFUSEMATERIALSOURCE applies only when COLORVERTEX is TRUE, and defaults to COLOR1. LIGHTING controls lighting. | Resulting alpha equation with lighting enabled or bypassed. |
| `imover_5des.content.htm`, Per-vertex Color States | When per-vertex color is enabled, four source selectors control diffuse, specular, ambient and emissive component sources. | Alpha transport from those inputs to output. |
| `imover_1rj8.content.htm`, Diffuse Reflection Model | Reflectance equation and source selectors establish RGB behavior. | A separate output-alpha rule. |
| `imover_0w10.content.htm`, Material Properties | Material properties contain RGBA/blending information; the Visual Basic emissive section also describes transparency. | Whether diffuse alpha alone survives, or other material alpha contributes. |
| `imover_8wbo.content.htm`, Color Values for Lights and Materials | Lights do not use alpha. | This does not determine material/vertex output alpha. |

These are existing files under
`scratch/runs/20261104-legacy-supported-computed-lighting/primary/`.
For the enumeration, render-state reference and per-vertex color page,
respectively, verified SHA-256 values are:

```
23023ace4691e70611ef2b0b500b9cd94f1c2ed2d4eec838e19ec331377dbe58
7bcb2f8393d9615e54150ac6c0fe2b79a5a849614a36de1eba3be51e08c97ff0
33134f6a7bb7e587d705e070c394be241c2ada05bab76830ed20164bd8044594
```

The run's `verified-primary-pins.json` references all 67 prior retained
primary entries by existing path, original URL, byte length and full hash.
All 67 byte lengths/hashes pass. `inspected-authority.json` records relevant
lines from eight inspected pages, including D3DMATERIAL7 and D3DCOLORVALUE.
No primary bytes, equation images, media or modules were copied. No network
retrieval or full SDK search was performed; absence from these inspected
pages does not prove that no DX7 document states the rule.

Current source-path inspection verifies the public vertex-buffer
ProcessVertices handler in `src/09aa-handlers-d3dim.wat` calls
`d3dim_vb_process_vertices`, with the remaining public arguments read from the
guest stack and 36-byte stdcall cleanup. In
`src/09ab-handlers-d3dim-core.wat`, the LIGHT operation bit invokes
`d3dim_d7_light_vertices`. That helper gates on XYZ/NORMAL and LIGHTING, then
uses `d3dim_d7_mat_color`: COLORVERTEX gates vertex selection, otherwise the
material color is used. Its final diffuse pack uses channel 24 of the selected
diffuse color. Material conversion clamps and rounds through
`d3dim_d7_unit`. This is **source behavior**, not primary authority or a new
observation from either shipped module. It cannot supply its own oracle.

Read the existing supported-computed-lighting, fresh-device-defaults and
nonuniform-normal tests. The public computed test calls actual COM
ProcessVertices/Lock with guards and excludes alpha from its expected RGB
records. Its present source colors and material diffuse alpha are opaque,
so it cannot discriminate material, vertex and constant-opaque hypotheses.
The fresh-device test checks state initialization/isolation; the normal test
checks bounded RGB behavior. The helper-based FVF lighting test's existing
alpha assertions do not add DX7 authority. None closes this prerequisite.

The exact unresolved matrix is LIGHTING on/off and LIGHT requested/omitted,
COLORVERTEX false/true, and diffuse source MATERIAL/COLOR1/COLOR2 with
different material diffuse, vertex diffuse and vertex specular alpha. A
primary DX7 statement must establish the output alpha for those controls
before an independent numeric oracle is chosen. Source selection alone,
later-version documentation, and agreement between two implementations
cannot establish that equation. Non-endpoint float-to-byte expectations
would also need a supported conversion rule or unambiguous inputs.

The offline integrity audit passed: 67 retained primary entries, eight
inspected pages and 13 input identities. Relevant tracked source/tests match
`e541f9781217ae244c2febd218502a37d0b29761`; entry HEAD is
`f7b34a442e38744a153d766c9757cb931ebb855f`. Both existing shipped module
identities are recorded, without claiming new execution:

| Path | SHA-256 |
| --- | --- |
| `build/wine-assembly.wasm` | `b74179b7570e3d9b87b088b53fb106aaba321cd6b256445bcbb362e634f1d1ea` |
| `build/wine-assembly.compat.wasm` | `716275cc2d6dee5a00941c1686e0ccb69cd7411c423dac5e8506cb62226ff724` |

No runtime regression or full build was rerun: this is a documentation-only
stop under the explicit unknown-rule condition. Consequently there are no
new successful public calls, output guards, stdcall/stack/state-isolation
results or independent negative controls for alpha. Both-module alpha
acceptance remains unperformed, not passed.

Evidence retains the exact Git SHA, relevant uncommitted binary diff, this
new document as a patch, the small audit script/log and full SHA-256 seal.
Git is the source archive; no snapshots, tars or synthetic fixtures were made.
Peer Stronghold files were untouched. No Chrome, game, boat API, allocation,
subworker, deployment, approval or lifecycle operation occurred. Box ID,
state and expiry: NA. The coordinator owns future allocation and shutdown.

Next required input: retained primary DX7 authority explicitly defining
computed diffuse output alpha and its source/COLORVERTEX interaction. The
exact missing document title/URL is unknown. No native Windows, hardware GPU
or gameplay claim. This single bounded assignment ends here.
