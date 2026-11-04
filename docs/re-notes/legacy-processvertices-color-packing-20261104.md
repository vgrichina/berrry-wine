# Public D3D7 ProcessVertices colored FVF packing

2026-11-04. Evidence: `scratch/runs/20261104-legacy-processvertices-color-packing/`.
Starting Git SHA is in `start-sha.txt`; final publication identity is in
`publication.json`. Accepted `f89825015` is a prerequisite, not rerun evidence:
its 70 generated-UV cases are neither repeated nor extended here.

Both actual shipped modules pass 72 colored-layout ProcessVertices-to-Lock
cases each. No supported positive case fails, so no production defect or
repair is claimed and `src/09ab-handlers-d3dim-core.wat` was never claimed or
edited. The changes are a public-COM regression and this bounded result.

## Contract and independent expectations

The retained original Microsoft DX7 SDK [Processing Vertices](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_3grp.content.htm)
describes copying components unaffected by the requested operation when
dwFlags is zero, and preserving the source buffer. Its example specifically
covers copying diffuse, specular and texture components for TRANSFORM alone.
It also requires normals for requested lighting. The cached primary pages
from the accepted processed-texture investigation were read locally; their
paths and hashes are in `input-references.json`. No network request was made.

The oracle lays out XYZ as three floats, optional NORMAL as three floats,
optional DIFFUSE and SPECULAR as DWORDs in that order, then the declared
texture sets. XYZRHW destinations start with four floats and have no normal.
There is no reserved DWORD between XYZ and the next FVF field. Texture size
encodings at bit 16+2*set are SIZE1=3, SIZE2=0, SIZE3=1, SIZE4=2.
Neither production packing/layout functions nor actual output supply the
expected bytes. The separate Python audit independently decodes FVF bits,
reconstructs source and destination allocations with struct packing, and
derives projection with exact Fractions.

Supplied diffuse values are `12345678,00000000,e19b2d47` and specular values
are `87654321,0f1e2d3c,00000000` (hex DWORDs). Distinct channel and alpha
bytes detect shifts, swaps, alpha replacement and treating zero as absent.
Every destination color field is present in the source; missing-color
defaults are deliberately outside this claim.

World rotates +90 degrees around Z and translates `(1/8,-1/4,1/8)`; view
cancels that translation. Projection has w=2z. Object positions `(0,0,1/2)`,
`(0,-1,1)`, `(-2,0,2)` therefore project through viewport `(3,5,64,32)` to
`(35,21,1/2,1)`, `(51,21,1/2,1/2)`, `(35,29,1/2,1/4)` as XYZRHW.
All expected floats are exactly binary representable, allowing complete byte
comparison without tolerance. Public matrix and viewport Get calls verify
the configured values.

## Coverage and observed output

Each module covers sources with and without NORMAL; DIFFUSE only, SPECULAR
only, or both; and every destination subset of supplied color fields,
including neither. Texture layouts are absent, FLOAT1/3/4/2 preserved exactly,
or FLOAT4/2/1/3 copied into FLOAT4/1/1/2. The last layout checks truncation and
different source/destination set offsets. Unique set/vertex/component values
are `(1+64*set+8*vertex+component)/128`. No missing set/component defaults,
generated coordinates, PROJECTED or enabled texture transform is tested.
Stage zero selects supplied set 2 with texture transformation disabled.

Public SetRenderState and GetRenderState explicitly establish LIGHTING=FALSE,
FOGENABLE=FALSE, COLORVERTEX=FALSE and NORMALIZENORMALS=FALSE. Of each module's
72 cases, 48 use TRANSFORM (1); 24 with supplied normals additionally request
LIGHT (`0x401`). The latter establish observed preservation under explicitly
disabled lighting, not computed-lighting colors or general LIGHT semantics.
Normal-bearing sources validate the offsets past the 12-byte normal and full
normal immutability; no destination-normal transformation claim is made.

Source index one and destination index two process three vertices from five
source vertices into six destination vertices. Both destination prefix
vertices and its suffix vertex retain exact 0xcd bytes. Entire source
allocations retain their pre-call bytes, including their 0xa5 guards.
Readback always uses public destination and source Lock/Unlock. Buffer
capacities, descriptor immutability, output pointer guards, bounded public
call completion, stdcall cleanup, caller RET and two stack canaries are checked.

Across both modules, `audit.json` verifies:

* 144 complete output allocations, 37,152 destination bytes, 324 supplied
  color DWORDs, 2,592 texture components and 1,728 position floats.
* 576 zero-count, end-source, end-destination and null-source guard calls,
  each preserving the entire destination and returning its expected HRESULT.
* 3,740 explicit stack-checked public calls. The fixture's final summary
  records are not counted as additional stack checks.

Three public-input negative controls each successfully process, then fail the
unchanged byte oracle: one diffuse byte, one specular alpha byte, or a supplied
third-set texture byte is changed. These demonstrate oracle discrimination;
they are not production failures. The initial harness mistakenly called
GetViewport in slot 14 (MultiplyTransform); the stack assertion rejected it
before processing. `initial/` preserves this harness error. Correct slot 15 is
used in final evidence. An exploratory earlier plan requested LIGHT without
normals; those cases were removed under the SDK requirement and are excluded
from all reported counts and conclusions. `final/` is authoritative.

## Verification and recovery

`test/test-legacy-processvertices-color-packing.js` reuses only the accepted
fixture bootstrap, replacing its draw loop with the new COM calls. It executes
DirectDrawCreateEx, QI D3D7, surface/device creation, state/transform access,
CreateVertexBuffer7, Lock/Unlock, ProcessVertices7 and Release through actual
x86 public vtables. It uses no test-only producer export or host calculation
in place of processing. It also passes without an evidence environment
variable and defaults to the ordinary unit tier.

The serialized `flock /tmp/wine-build.lock bash tools/build.sh` passes, followed
by the focused regression, independent audit and ordinary no-evidence run.
Both shipped build outputs match their prior accepted hashes:

| Module | SHA-256 |
| --- | --- |
| `build/wine-assembly.wasm` | `b70c420e0a29c8664df1c3ed8b8074b590c342ed2a60078172b30e90922800cf` |
| `build/wine-assembly.compat.wasm` | `4771c78ba2cc1b84875e1e90a743f7fa624975764607c3d86a516fbcd1cd5d00` |

Recovery uses Git SHA, relevant binary diff, owned new-file patches and input
path/hash references. No source archives, module copies or media copies were
made. This is offline Node public-COM evidence, without browser, GPU, game,
remote API, box, subworker, deployment or lifecycle action. No box was assigned;
ID/state/expiry are inapplicable and lifecycle remains coordinator-owned.

Limits include computed lighting, missing colors/normals, destination normals,
nonrigid normals, strided sources, other flags, aliasing, clipping, native
Windows parity, application gameplay and the broader legacy capability audit.
Next is a separately scoped supported computed-lighting or other demonstrated
positive-path failure; these passing preservation cases justify no producer
change. This single assignment is complete and stops here.
