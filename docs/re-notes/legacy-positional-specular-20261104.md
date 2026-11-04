# D3D7 public point/spot specular RGB

Run: `scratch/runs/20261104-legacy-positional-specular/`.
The configured positional RGB path already works after accepted directional
implementation `5ac786cfd29b3d668620325511a4d66e54400aac`. No production defect
was demonstrated, so `src/09ab-handlers-d3dim-core.wat` was neither claimed nor
changed. This adds a discriminating public regression and preserves exact
outcomes; it does not claim a new directional implementation.

`test/test-legacy-positional-specular-lighting.js` uses the existing public
x86 COM mechanics from the point/spot and specular tests. Its independent
numerical oracle transcribes the retained DX7 equation images:

```
L = normalize(lightPosition - worldVertex)
E = normalize(-cameraVertex), or (0,0,-1) for orthogonal viewing
H = normalize(E + cameraDirection(L))
Rs = clamp(N.H, 0, 1)^power
D = length(lightPosition - worldVertex)
Adistance = 1 / (attenuation0 + attenuation1*D + attenuation2*D*D)
rho = -dot(L, normalize(spotDirection))
Acone = 0 outside phi/2, 1 inside theta/2,
        ((rho-cos(phi/2))/(cos(theta/2)-cos(phi/2)))^falloff between
RGB = selectedSpecular * lightSpecular * Rs * Adistance * Acone
```

Distance greater than range suppresses the contribution; equality remains
inside. Explicit zero power, disabled specular, and disabled lights produce
black RGB. Final channels saturate. Cases avoid zero distances, zero halfway
vectors, invalid cone intervals, and nonpositive attenuation denominators.
The one-byte RGB envelope admits unspecified byte quantization, while
geometry and guard bytes are exact.

The original specular content and four equation GIFs remain at
`scratch/runs/20261104-legacy-retained-specular-implementation/primary/`.
Distance and cone content and images remain at
`scratch/runs/20261104-legacy-point-spot-public-lighting/primary/`.
This task read the retained content and personally viewed the halfway,
reflectance, component, attenuation, falloff and spotlight sign diagrams.
`inputs.json` references those existing files by path, size and SHA-256;
there was no download or media/module copy.

Both shipped modules passed 29 positive cases and 22 successful public
state-changing controls each, with 1,607 guarded COM calls per positive run.
Cases cover independently varying positions, normals, local/orthogonal eyes,
constant/linear/quadratic/mixed attenuation, equal/inside/outside range,
inner/penumbra/outside cones, falloff, displaced/oblique spotlights, rigid
world/view changes, selected vertex colors, power, normalization and material
floats before packing. A point-light axis change is also checked to leave
RGB unchanged. Controls hold the original RGB expectation while changing
the light position, viewer, attenuation coefficients, range, cone direction,
theta, phi, falloff, point/spot type, matrices, color source, light color,
light enable, specular enable, power and normal. Each reaches successful
ProcessVertices and Lock readback, then fails the stale RGB expectation only
after completing source immutability, Unlock and Release checks. These are
test discrimination controls, not evidence of a production failure.

All cases use source index 1 and destination index 2. Full source buffers
remain immutable; destination prefix/suffix and geometry are checked. Public
zero-count and invalid-source/destination operations preserve destination
bytes. Every public COM call checks stack restoration and guards. Set/Get
material, lights, transforms and render states check their roundtrips and
input immutability. Diffuse RGBA and specular/fog alpha remain unasserted.
No default-state or nonuniform-transform semantics are inferred.

Representative exact RGB bytes, identical for both module variants:

| Case | Vertex 0 | Vertex 1 | Vertex 2 |
| --- | --- | --- | --- |
| Displaced point, orthogonal | 191,128,75 | 83,55,32 | 160,107,63 |
| Same point, local viewer | 191,128,75 | 27,18,11 | 72,48,28 |
| Point range inside/equal/outside | 201,135,79 | 201,135,79 | 0,0,0 |
| Spot inner/penumbra/outside | 201,135,79 | 91,61,36 | 0,0,0 |
| Same spot, squared falloff | 201,135,79 | 45,30,18 | 0,0,0 |
| Spot distance times cone | 67,45,26 | 30,20,12 | 0,0,0 |

`exact-readbacks.json` preserves all cases with real-valued expectations.
Initial tested module hashes were
`3dcd13cc618fe85624f92a88065daff44afc6f8f8c41eda0f6d82f1c6ccee9c5` and
`c9d364cf43cf055d3abcd4a056eb8dcdce5f1b918c6aad332dbd0816ec83a699`.
Focused verification includes positional, accepted directional, point/spot,
public computed-lighting/setup, FVF, ProcessVertices, dimensional vertices,
vertex fog and ProcessVertices fog, plus the serialized full build. Commands,
exit statuses and small logs are retained in the run directory.
The first dimensional invocation omitted its required `LEGACY_PV_EVIDENCE`
variable and stopped at its harness assertion; the corrected invocation
passed all four direct/queued, indexed/nonindexed cells and four controls.
The final positional rerun after the locked build passed both variants with
the same module hashes and identical full destination readbacks.

Recovery uses the recorded Git SHA and relevant binary diff/new-file patches,
then `flock /tmp/wine-build.lock bash tools/build.sh`. `artifact-seal.json`
records artifact hashes; `publication.json` records the published commit and
origin owned-blob comparisons. No source snapshots or archives were made.

The concrete next implementation prerequisite is a fresh-device default-state
audit: pair exact retained DX7 defaults for SPECULARENABLE, LOCALVIEWER,
NORMALIZENORMALS, COLORVERTEX and SPECULARMATERIALSOURCE with successful public
GetRenderState readbacks immediately after CreateDevice, before setting any
lighting state. Only a demonstrated mismatch would justify a constructor
initialization change. This configured positional test cannot establish that
contract. Nonuniform transforms, output alpha and native Windows/GPU comparison
also remain open.

This was offline Node/Wasm work only. Box ID/state/expiry: not applicable.
No Chrome, game runtime, boat API, workers, deployment or lifecycle action was
used; the coordinator owns future runtime allocation and shutdown.
