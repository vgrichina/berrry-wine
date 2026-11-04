# Public D3D7 ProcessVertices computed lighting: RGB repair, alpha still open

2026-11-04. Run: `scratch/runs/20261104-legacy-supported-computed-lighting/`.
This closes the RGB equation/material-source prerequisite left by `edfb91e3b`
and repairs a demonstrated public producer defect. The complete requested
RGBA contract remains **partial**: an explicit DX7 computed-output alpha rule
was not located. Alpha bytes are retained as observations, never acceptance
values. No later-version alpha rule or rounding convention is assumed.

## Primary contract recovered

Read-only HTTPS retrieval followed the original Microsoft DX7 SDK table of
contents: Immediate Mode Essentials → Lighting and Materials → Mathematics →
Reflectance Model → Diffuse Reflection Model. The equation GIFs were retrieved
and visually inspected, including the summation and reversed direction.
`primary/manifest.json` retains every successful URL, byte length and SHA-256;
the original response bytes remain beside it. No browser was used.

For each RGB channel the SDK gives:

```
Rd = clamp((-normalize(D)) dot N, 0, 1)
Dv = Ia*Va + Ve + sum_active_lights A*(Rd*Vd*Ld + Va*La)
```

`D` travels toward the vertex; `N` is normalized only when that state is
enabled. `Ia` is scene ambient; `Va`, `Vd`, `Ve` are selected ambient, diffuse,
emissive colors; `La`, `Ld` are the light's ambient and diffuse colors. `A`
combines distance attenuation and spotlight falloff; directional lights skip
distance attenuation. These tests use unit normals, a rigid world rotation,
directional light `(0,0,-1)`, and no spotlight term. The DX7 light model uses
independent light components, unlike the single light color before DX7.

With COLORVERTEX enabled, source selectors are MATERIAL=0, COLOR1=1 (vertex
diffuse), COLOR2=2 (vertex specular). Disabled COLORVERTEX selects material
colors. All selectors and enable/state values are set explicitly and read
back. This matters for version differences: the retrieved DX7 render-state
reference lists ambient-source default COLOR2; later D3D9 documentation lists
MATERIAL. Neither default is used as a test prerequisite.

Key exact primary URLs and SHA-256 hashes:

| Document / URL | SHA-256 |
| --- | --- |
| [Diffuse Reflection Model](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_1rj8.content.htm) | `597355b616c005d0c35e9aa39e77bdfab3d697bcf27dc0dd947f6bd899b8c7e9` |
| [Diffuse equation image](https://library.thedatadungeon.com/directx7/devdoc/live/directx/images/diffamb.gif) | `a7e2e42f98ff7650c4fc9233f259cb0578d51b6a60fdb10141131c08667e724a` |
| [Dot-product image](https://library.thedatadungeon.com/directx7/devdoc/live/directx/images/diffrefl.gif) | `592dbd9c7b93e47e0b0ce2b8cbe56421602b55fe6ba185440005256c534be829` |
| [Material-source enumeration](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_192c.content.htm) | `23023ace4691e70611ef2b0b500b9cd94f1c2ed2d4eec838e19ec331377dbe58` |
| [DX7 light components/version distinction](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_7q5h.content.htm) | `34b39bc96eb4aeb1256a4dde7f2b128a5978c863a43f142fdb321ac98bf293de` |
| [Per-vertex color states](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_5des.content.htm) | `33134f6a7bb7e587d705e070c394be241c2ada05bab76830ed20164bd8044594` |
| [Color values; light alpha unused](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_8wbo.content.htm) | `134808ba0945a3823c2745f5acc31df258173dececbcf441db4961e2cb68c245` |
| [RGBA field definitions](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_37ac.content.htm) | `09f398926baf50a5ae482a9bd83f865a7173a687da7f055b62c57b4c04c29b46` |
| [Render states](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_5fdw.content.htm) | `7bcb2f8393d9615e54150ac6c0fe2b79a5a849614a36de1eba3be51e08c97ff0` |
| [FVF memory order/restrictions](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_4d2d.content.htm) | `774138de1c3daa1cf2a604f8bf3935b5a0a7eb7874f2bd5ff2584ec412220437` |

The retained [Material Properties](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_0w10.content.htm),
D3DMATERIAL7, D3DCOLORVALUE and Alpha-Blending States pages define alpha as
transparency/blending information; lights do not use their alpha components.
They do **not** explicitly specify which alpha survives computed DX7 lighting
or its conversion. A search found an explicit DX6 rule and later Microsoft
vertex-alpha documentation, but those were not promoted into DX7 authority.
Network access works; this is an unresolved document/semantic gap, not a claim
of network failure. `primary/failed-attempts.json` records the archive filter's
closed connection and a guessed reference URL's 404; neither proves a missing
DX7 document. Exact missing authority: DX7 computed diffuse-output alpha and
its material-source interaction. No exact title/URL for that authority is known.

## Supported failure and narrow repair

Both original shipped modules successfully called ProcessVertices and Lock,
but returned supplied RGB rather than computed ambient/emissive/directional
RGB. Initial three-case failures were retained before claiming production.
The final nine inputs also reproduce failures against byte-identical original
modules rebuilt **in memory** from the starting Git SHA: original hashes
`b70c420e0a29c8664df1c3ed8b8074b590c342ed2a60078172b30e90922800cf`
and `4771c78ba2cc1b84875e1e90a743f7fa624975764607c3d86a516fbcd1cd5d00`.
`reproduce-final-inputs.js` records the recovery recipe, hashes and failures;
no old module or source-tree copy was saved.

`src/09ab-handlers-d3dim-core.wat` now invokes the existing Device7 lighting
stage for ProcessVertices LIGHT before projection/unpacking. It passes the
original source FVF and source-index-adjusted vertices so lighting sees normals
and both vertex colors, then uses the returned packed vertex type. TRANSFORM
alone skips this new route. The existing stage retains its explicit LIGHTING
and Device7 material/light gates. There is no lighting-equation or alpha change.

## What the new regression proves

All nine cases request LIGHT+TRANSFORM (`0x401`), LIGHTING=true, flags zero,
unlocked valid XYZ|NORMAL sources and XYZRHW|DIFFUSE destinations. Material
ambient plus emissive produces magenta. The directional case combines global
blue ambient, red per-light ambient and green diffuse: facing is white;
tangent and away are magenta. Both run with no source colors, diffuse only,
and diffuse+specular. A COLOR1-emissive/COLOR2-ambient case produces yellow,
cyan, magenta. Two directional cases select diffuse from COLOR1 or COLOR2 and
produce red or green for facing, black for tangent/away.

Inputs and RGB results use 0/1 float values and 0/255 color channels only;
no resulting channel exceeds one before conversion.
They avoid rounding boundaries and intermediate material quantization. This
does not establish a general float-to-color rounding rule. The final RGB,
all position floats and destination sentinels have exact independent oracles.
The 54 output alpha bytes are read and retained, excluded from acceptance.

Both shipped modules pass: 18 output allocations, 54 vertices, 162 computed
RGB bytes, 2,106 checked destination bytes, 72 guard ProcessVertices calls and
878 stack-checked public calls. Source index one and destination index two
exercise nonzero offsets; entire source allocations remain immutable, and
destination prefix/suffix records retain 0xcd. Source guards retain 0xa5.
Zero count, source end, destination end and null source check HRESULTs and
unchanged destination allocations through fresh Lock/Unlock calls.

The fixture executes real x86 COM calls from DirectDrawCreateEx and D3D7 QI
through device/state/material/light/buffer creation, ProcessVertices, Lock,
Unlock and Release. It checks descriptor/Set-input immutability, guarded
output pointers, buffer sizes, HRESULTs, bounded completion, exact stdcall
cleanup, caller RET and both stack canaries. No test-only lighting export or
host replacement computes the actual results.

Five successful-input negatives fail the independent unchanged RGB oracle:
emissive removed, directional sign reversed, emissive selector changed,
LIGHTING disabled, and LIGHT omitted. Their ProcessVertices HRESULTs succeed.
`audit.py` independently decodes FVF bits, reconstructs source bytes, uses
Fraction arithmetic for RGB and projection, and verifies all output and guard
counts. No producer helper or observed output supplies its expectations.

## Verification and remaining boundary

Focused public regression, ordinary no-evidence invocation, independent audit,
existing D3D7 FVF-lighting test, ProcessVertices test and ProcessVertices fog
test pass. The required serialized full build passes. Its first attempt hit
a peer's in-flight callback census; no peer files were changed to bypass it.
Final shipped hashes are
`4417305d70322467441aef51e888b0fe66451d9c60da0c734eeb23f5a22c0a6b`
and `07fb4e75d05177271097dcd67d84e2629272b50073074bbdea8825ce10b4ed34`.

Evidence records Git identities, relevant binary diff, owned new-file patches,
input path/SHA-256 pins, primary response bytes and unique logs. Media remains
at its existing path/hash. No source archives, module/media copies, gzip
decoding, Chrome, game, GPU, remote API, deployment or subworker operation.
Assigned box ID/state/expiry: NA; lifecycle remains coordinator-owned.

Next: locate explicit DX7 output-alpha authority before a full RGBA oracle.
Also unproved: non-endpoint quantization, specular computation, nonrigid
normals, point/spot lights through this public route, missing-color defaults,
native Windows parity and gameplay. This bounded assignment ends with the
RGB producer repair and the remaining alpha prerequisite stated explicitly.
