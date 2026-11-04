# Public D3D7 ProcessVertices point/spot RGB lighting

2026-11-04. Evidence: `scratch/runs/20261104-legacy-point-spot-public-lighting/`.
The public route repaired by `61802c92d8661f59a8cf0c90a5254a94b0d42e56`
also computes the supported point/spot RGB cases below. No production failure
was demonstrated and no production source was changed. The new regression is
`test/test-legacy-point-spot-public-lighting.js`. It reuses the previous public
x86 COM fixture mechanics, with independently authored literal RGB expectations.

The existing DX7 computed-output alpha authority gap remains open. All 72
positive output alpha bytes are retained but excluded from acceptance. This
suite establishes neither a full RGBA contract nor a general rounding rule.

## Retained primary rules

Read the previous note and retained DX7 diffuse-reflection, material-source
enumeration and per-vertex-color pages. Read-only HTTPS retrieval followed
their links to these original Microsoft DX7 SDK pages and equation images.
`primary/manifest.json` records exact URLs, lengths and SHA-256 values;
unaltered response bytes are retained. The equation and spotlight sign images
were visually inspected. Network retrieval is independent of the offline run.

| Primary DX7 page | SHA-256 |
| --- | --- |
| [Light Attenuation Over Distance](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_31us.content.htm) | `c89ebff8b754c2be162da9328273a615b6e92509ed3e7be1b1875e989435136a` |
| [Attenuation equation](https://library.thedatadungeon.com/directx7/devdoc/live/directx/images/attenu8.gif) | `daf3b5290e64f096b3300ee3755d9b5c3b300d7fd92bffd8555d1c8752fb322c` |
| [Spotlight Falloff Model](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_04h0.content.htm) | `9d3825745d1e24fb343f0f35d5e8fd2dce4eeac99c9edca358e9a849a438e5fe` |
| [Falloff equation](https://library.thedatadungeon.com/directx7/devdoc/live/directx/images/falloff.gif) | `72b3ea7830b87d952bc2b981e2dcb9e534b12b3e0ae4f99d540a762a77d13ef1` |
| [D3DLIGHT7](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_521w.content.htm) | `1001fb12ec17af11e2f0321092e64487b0e95237b931279146eb4490886584a9` |
| [D3DLIGHTTYPE](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_4g84.content.htm) | `f696a686a9b3faecebc60ee909e4417bf5535aee53f194e4b741628f5f26c359` |

For point/spot lights, distance is `d = |light.position - world.vertex|`.
When `d > range`, the light contributes nothing; equality is within range.
Otherwise attenuation is `1 / (a0 + a1*d + a2*d*d)`. Directional lights
ignore position, range and these coefficients. These cases use positive
denominators and attenuation at most one, avoiding degenerate/clamping rules.

With `L` the spotlight's outward unit axis and `D` the unit vector from vertex
to light, the SDK illustration explicitly gives `rho = -L dot D`. This sign
resolves the text's loose description of the vectors. Let `ct=cos(theta/2)`
and `cp=cos(phi/2)`: spotlight intensity is zero at/below `cp`, one at/above
`ct`, and `((rho-cp)/(ct-cp))^falloff` between them. Both angles are total
cone angles, supplied in radians. Distance attenuation multiplies this term.

RGB then follows the previously retained DX7 equation:
`Ia*Va + Ve + sum A*(max(0,N dot D)*Vd*Ld + Va*La)`.
All normals here are unit vectors and the world/view transforms are identity.
Global ambient and emissive are explicitly zero. Independent per-light
diffuse and ambient channels make their attenuation observable separately.
MATERIAL=0, COLOR1=1 and COLOR2=2 select material, vertex diffuse and vertex
specular, respectively; COLORVERTEX and all selectors are explicitly set/read.

## Cases and independent arithmetic

The twelve positive states run on each shipped module:

| State | Discriminating geometry/equation | Expected RGB, vertex 0 / 1 / 2 |
| --- | --- | --- |
| Point constant | distances 1,3,9; denominator 3 | (67,67,0) / (67,67,0) / (67,67,0) |
| Point linear | distances 1,3,9; denominator d | (201,201,0) / (67,67,0) / (22,22,0) |
| Point constant + linear | denominator 2+d | (67,67,0) / (40,40,0) / (18,18,0) |
| Point quadratic | distances 1,2,4; denominator 1+2d² | (67,67,0) / (22,22,0) / (6,6,0) |
| Point range | distances 1,3,9; range=3, denominator d | (201,201,0) / (67,67,0) / black |
| Directional | distant position, range=.25, coefficients 3,7,11 ignored | (201,201,0) at all three |
| Point COLOR1 diffuse/COLOR2 ambient | red/green/blue vs green/blue/red source colors | (201,201,0) / black / black |
| Point COLOR2 diffuse/COLOR1 ambient | swapped selectors, same distance attenuation | black / (0,67,0) / (22,0,0) |
| Spot inner/penumbra/outside | axis, 3-4-5 ray, outside ray | (204,186,0) / (102,74,0) / black |
| Spot falloff squared | penumbra intensity 1/4 instead of 1/2 | (204,186,0) / (51,37,0) / black |
| Spot distance × cone | denominator 3, independent green intensity .71 | (68,60,0) / (34,24,0) / black |
| Spot range | range=4 excludes all three distances | black at all three |

Point diffuse red and ambient green intensities are .79: their unattenuated
byte-scale value is 201.45. Spot ambient red is .801 and diffuse green .73;
the distance-times-cone case uses green .71. Inner/outer cosine thresholds
are .9/.7. At `(3,0,4)`, distance=5, rho=.8, diffuse cosine=.8 and cone
intensity=.5 (or .25 for falloff=2). The outside vertex `(4,0,2)` has
rho=1/sqrt(5), safely below .7. Cone angles are packed to f32 before SetLight.

`audit.py` independently reconstructs source bytes and the 104-byte D3DLIGHT7
layout, decodes source/destination FVF, and evaluates the RGB equation using
Python Fraction arithmetic. It proves that truncation and nearest-integer
conversion agree for every tested nonzero channel, with at least .04 byte
margin from either interval edge. Float packing/trigonometric error is far
smaller than this margin; the audit separately bounds packed-angle cosine
error below 1e-7. No producer helper, producer output or intermediate producer
color supplies the literal expectations. This does not claim every possible
conversion method is equivalent or establish non-endpoint rounding semantics.

Projection uses `w=2z`, viewport `(3,5,64,32)`, giving
`(35+16x/z, 21-8y/z, .5, 1/(2z))`. The audit checks its exact f32 bytes.
During fixture development an outside ray with nonbinary x/z exposed an
arithmetic-order geometry discrepancy, and a combined spot green input exposed
a truncation/nearest ambiguity. Inputs were revised before acceptance.
`fixture-development-quantization.json` retains the latter input and mismatch;
it is an oracle-development artifact, not a demonstrated producer failure.

## Actual public calls and controls

Execution starts with actual x86 DirectDrawCreateEx/QueryInterface, creates
a D3D7 device and vertex buffers, sets/reads matrices, viewport, material,
light, enable and render states, then calls public ProcessVertices and Lock.
No draw, GPU path or host-side replacement computes the actual output.
The fixture supplies the exact shipped `Math.cos`/`Math.pow` host imports
used by the Wasm stage; all lighting, attenuation and packing remain in Wasm.

Every input uses LIGHT|TRANSFORM (`0x401`), flags zero, source index 1,
destination index 2 and count 3. The entire five-record source allocation
remains unchanged, including 0xa5 guards. Six-record destinations keep 0xcd
prefix/suffix records. Geometry is asserted byte-for-byte and only the three
RGB bytes in each written color are accepted. Descriptor and Set-input
immutability, guarded output pointers, capacities, HRESULTs, stdcall cleanup,
caller RET, bounded completion and stack canaries are checked. Zero-count,
source-end, destination-end and null-source calls check HRESULTs and complete
destination immutability through fresh public Lock/Unlock.

Totals for positives: 24 allocations, 72 vertices, 216 RGB bytes, 2,808 checked
destination bytes, 96 guard ProcessVertices calls and 1,124 stack-checked
public calls. The independent audit verifies these counts.

Seventeen controls per module change one decisive state: point/directional
type, position, range, constant/linear/quadratic coefficient, spot direction,
theta, phi, falloff, spot/point type, diffuse/ambient material source,
diffuse/ambient light intensity, enable, and spot range. All 34 controls
successfully set/read state and complete ProcessVertices, retain the original
RGB table, and fail it. RGB failure is deferred until after source, geometry,
destination guards and Unlock/Release checks, so controls exercise those too.

## Verification, identities and remaining boundary

Focused evidence run, ordinary no-evidence invocation, independent audit,
previous supported-computed-lighting regression, D3D7 FVF lighting,
ProcessVertices dimensional regression and ProcessVertices fog regression all
pass. `flock /tmp/wine-build.lock bash tools/build.sh` passes. The test uses
the ordinary default test tier and needs no evidence environment variable.

Starting recorded Git identity: `de6a33f257d93e8814d666bdec62361161569ac4`;
validation head: `d17c8d23c59e7efbcf7fd16226065758ab962d9a` (peer docs only).
Original and current modules are identical across the serialized build:

| Existing path | Original/current SHA-256 |
| --- | --- |
| `build/wine-assembly.wasm` | `4417305d70322467441aef51e888b0fe66451d9c60da0c734eeb23f5a22c0a6b` |
| `build/wine-assembly.compat.wasm` | `07fb4e75d05177271097dcd67d84e2629272b50073074bbdea8825ce10b4ed34` |
| `test/binaries/calc.exe` | `cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b` |

`identities.json`, relevant binary diff, owned new-file patches, dependency
hashes, primary manifests, test logs and `SHA256SUMS` retain recovery evidence.
Git remains the source archive. No source-tree snapshots or module/media
copies were made. No peer guest-worker, cache-observer or tools file was edited.

Remaining boundary: explicit primary DX7 computed-output alpha and its
material-source interaction are still needed before a full RGBA oracle.
Specular lighting, degenerate light configurations, arbitrary conversion,
nonrigid normals, native Windows/GPU parity, 27-app coverage and gameplay
remain unproved. No Chrome, game, boat allocation, subworker, deployment or
runtime lifecycle operation was performed. Assigned box ID/state/expiry: NA.
The coordinator retains ownership of future runtime work and shutdown.
