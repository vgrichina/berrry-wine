# Public legacy MIRROR and independent U/V rendered contract

Task: advance `D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013` with actual software
rendering of advertised MIRROR and independent address modes. Result: **PASS
on both production modules**, 480 exact RGB observations and ten rejected
rendered negative controls per module. No production addressing defect was
found. GPU and queued MIRROR/independent-UV rendering are **unknown and
unexecuted** in this task; preceding WRAP/CLAMP or BORDER evidence does not
qualify them.

Tested source baseline: `91cdc03b8c0990604374e0999e9629be62f71b24` plus the
owned new fixture patch. The full locked build passes. The new fixture is
registered beside the existing public legacy fixture in the E2E tier because
it requires explicit prebuilt modules and an evidence directory.

## Executed contract

`test/test-legacy-mirror-uv-contract.js` imports the existing
`browserFixture` export from `test/test-legacy-texture-rendered-contract.js`.
Checked, unique source substitutions replace only the sampler setter block,
the address argument to the independent oracle, and capability assertions.
This preserves its real DD7 factory dispatch, QI D3D7, CreateSurface,
CreateDevice7, public x86 vtable calls, HRESULT/ESP/guard checks, geometry,
software draw, and Surface7 Lock/Unlock pixel readback. An upstream change to
an adaptation seam fails explicitly. The original fixture is unchanged.

Node v24.18.1 executes this harness with software rendering enabled and GPU
disabled. Its three fetch routes supply the actual module, import signatures,
and original calc bootstrap PE from local bytes. Canvas presentation methods
are inert; every asserted pixel still comes from the public target Lock after
the production WAT rasterizer draws. No browser, game runtime, remote box,
rendering import replacement, extracted handler, or seeded device record is
used. No box was assigned or acquired; box ID/state/expiry are inapplicable.

Each module executes 2,675 actual guest invocations in the positive arm
(including the factory), 480 draws and 480 exact pixel comparisons. One device
and texture run through point → linear → point. Each pass visits U/V pairs:

`WRAP/WRAP → MIRROR/WRAP → MIRROR/MIRROR → WRAP/MIRROR → CLAMP/MIRROR →
CLAMP/WRAP → CLAMP/CLAMP → MIRROR/CLAMP → WRAP/CLAMP → WRAP/WRAP`.

Adjacent states change one axis. After each U setter, both U and the untouched
V are read through public GetTextureStageState7; after each V setter both are
read again. Both axes are explicitly initialized to WRAP before this sequence.
The first execution exposed the harness assumption that an untouched axis
already read back as WRAP: it actually returned zero. The initial failure is
retained; explicit public initialization fixes the fixture without changing
production behavior or weakening an assertion.

Sixteen coordinate pairs include fractional interiors, positive and negative
mirror periods from -17/8 to 25/8, and exact seams at -2, -1, 0, 1, 2 and 3.
Mixed signs and asymmetric coordinates distinguish U from V. The original
four distinct RGB texels and constant-UV triangle are retained, including the
exact X8R8G8B8 target and observed target pixel (2,2).

The independent oracle folds each tap's continuous center into [0,1]: WRAP
uses its fractional part, MIRROR uses a triangular wave with period two, and
CLAMP saturates it. It then selects the texel and integrates four separable
tent weights for linear filtering. This differs from production's integer
remainder/reflection implementation. It calls no production sampling,
descriptor, shader or backend helper. All expected channels are integral;
comparison is exact, with no tolerance or target-format reconstruction.
Hand-calculated anchors and complete state restoration are asserted by the
planner. Planning alone is never reported as rendering success.

Public GetCaps returns both line/triangle address masks **0xf7**, including
MIRROR (0x02) and INDEPENDENTUV (0x10), and texture masks **0xf7df**. Both exact
masks are asserted. BORDER (0x08) and cube (0x0800) stay unadvertised.

## Rendered negative controls

Each control changes only the public setter sequence and leaves the requested
state and independent pixel oracle unchanged. All controls must reach a
successful DrawPrimitive7 and then fail specifically at `PIXEL ORACLE`, with
an actual observed RGB mismatch. Bootstrap/readback failures cannot pass.
Each runs separately under point and linear filtering on both modules:

| Broken setter policy | Point observed / expected | Linear observed / expected |
| --- | --- | --- |
| WRAP substituted for MIRROR | 160,32,64 / 32,64,96 | 142,66,86 / 40,96,80 |
| U left stale | 160,32,64 / 32,64,96 | 142,66,86 / 40,96,80 |
| V left stale | 32,64,96 / 64,192,32 | 40,96,80 / 64,192,32 |
| V coupled to U | 64,192,32 / 32,64,96 | 64,192,32 / 40,96,80 |
| U coupled to V | 160,32,64 / 32,64,96 | 142,66,86 / 40,96,80 |

These mismatches occur at sample `(-17/8,9/8)` after a discriminating state
transition. Full calls, state readbacks, raw pixels, expected channels and DIB
arrays are retained in the run JSON.

## Evidence and reproduction

Ignored evidence directory: `scratch/runs/20261104-legacy-mirror-independent-uv/`.
Final numeric results are `canonical-final/result.json` and
`compat-final/result.json`; their actual tested modules are retained alongside.
Earlier numeric runs and the initial readback failure are retained separately.
`build-final.log` records the mandatory full locked build;
`test-tiers.log` and `test-test-tiers.log` record tier validation and its focused
regression. `source-seal.json` records the Git
baseline and source/input hashes. Relevant binary diffs and owned new-file
patches are retained as `relevant.patch`, `fixture.patch`, and `note.patch`.
`initial-fixture-from-final.patch` reconstructs the initial failed fixture from
the final fixture, verified against its recorded SHA-256. No source archive or
media copy was made. The repository-wide evidence checker reports existing
foreign run problems and no references to this run; these contract results
are investigation evidence, without an unrelated corpus candidate attachment.

Actual module SHA-256:

- Canonical, 2,143,712 bytes:
  `1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`.
- Compatibility, 2,146,325 bytes:
  `74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66`.
- Executed new fixture:
  `0131ee66a7c00254e915e7c71a26d9152fec9d9fc11167315b7f48e73676226f`.
- Reused public fixture:
  `3d5c364c48933c785b3d0910640be13733ceda3704cbccc8aa7b0e0eebaf54cc`.
- Existing `test/binaries/calc.exe`:
  `cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b`.

Reproduce from the pinned Git baseline plus the patches, using the existing
calc PE at its recorded hash:

```sh
flock /tmp/wine-build.lock bash tools/build.sh
LEGACY_MIRROR_EVIDENCE=scratch/runs/<fresh-id>/canonical \
  flock /tmp/wine-build.lock timeout 180s node test/test-legacy-mirror-uv-contract.js
LEGACY_MIRROR_EVIDENCE=scratch/runs/<fresh-id>/compat \
  flock /tmp/wine-build.lock timeout 180s node test/test-legacy-mirror-uv-contract.js --compat
```

`LEGACY_MIRROR_MODULE_DIR` optionally selects retained modules instead of
`build/`. `--plan` performs only numerical checks. Run one local fixture or
build at a time under `/tmp/wine-build.lock`.

Remaining scope: GPU/queued rendering for these address combinations, other
texture dimensions/formats, mip selection, perspective gradients, other legacy
interface revisions and original-game behavior. Cube/BORDER implementation,
resource-lifetime behavior and corpus closure are outside this bounded result.
