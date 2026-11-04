# Generated normal/reflection PROJECTED on actual WebGL1/2

2026-11-04. Run: `scratch/runs/20261104-legacy-generated-projected-webgl/`.
Source revision and all 48 runtime pins are in `source-seal.json`. This tests
the generated normal/reflection repair `e6a787467`; it does not rerun the
accepted camera-position PROJECTED suite.

## Result and defect boundary

All 32 positive cells pass on the actual browser graphics contexts:
canonical/compat modules × WebGL1/2 × immediate/physical owning Worker ×
ordinary/indexed × direct/VB sources. This is 736 successful public COM draws
and 2,208 exact RGB observations, including 608 generated PROJECTED draws and
1,824 generated pixels. The remaining 128 draws/384 pixels are supplied and
XYZRHW bypass controls. Both COUNT3/4, all four diffuse/specular layouts,
lighting conversion and explicitly normalized reflection are included.

No positive-path renderer or transport failure occurred. Accordingly this
task makes **no new production renderer repair claim** and changes no production
renderer file. It establishes actual WebGL acceptance of the existing repair.
The requested conditional stop point was the actual pixel result; there was
no first failure to diagnose or justify a production OWN/edit. The browser
closed after the controls, with no second launch.

The 26 rendered negative controls reject zeroed normals, identity matrix,
supplied selection, constant texture q, lost texture z, explicit per-vertex
early division for both modes, and normal selection instead of reflection,
on both WebGL versions. Every rejection follows a successful public draw and
an actual pixel mismatch at unchanged tolerance zero. Early division yields
the predecessor baseline pixels: normal `[55,30,201]` versus `[185,82,19]`,
reflection `[107,82,201]` versus `[107,69,136]`. These are intentionally faulty
public inputs, not newly discovered production failures.

## Fixture and independent checks

`test/test-legacy-generated-projected-webgl.js` reuses the exported
`fixtureSource`, `config` and `oracle` from
`test/test-legacy-generated-normal-reflection-projected.js`, the actual
browser lifecycle/HTTP/bootstrap harness from the count-selector runner,
and its underlying projected browser fixture. The exported software `run`
supplies a separate two-draw/six-pixel control, not GPU evidence.

The new fixture holds production endpoint batch delivery to the physical
owning GL Worker. Across all 16 Worker cells, 368 held records, including 304
PROJECTED records, survive public world/view/texture/selector/flags changes,
direct-source/index overwrites and public VB Lock/overwrite/Unlock. Full held
bytes compare identically before and after mutation. Captured vertices retain
independent camera normal/reflection XYZ1 and geometric reciprocal W. Public
target Lock provides the completion/readback fence. Owning Worker statistics
show the requested WebGL version and zero software draws, fallback draws,
fallbacks and errors. Immediate cells additionally compare actual GL
`readPixels` RGBA with the oracle and check GL error zero.

To avoid 1,024 cross-Worker reads per observation, completed Lock backing is
read through a DataView after the public Lock fence. The selected sample still
uses the public guest read; the retained full DIB supports inspection. No
production transport, synchronization or sampling helper supplies expectations.

The independent Python Fraction audit derives object/world/view geometry,
unit eye vectors, reflected vectors, texture U/V/Q, geometric W and texel
addresses. It verifies all 2,208 positive pixels, 1,824 distinctions from early
division, 368 captured records, all 26 negative mismatches and 26,416 explicit
stack cleanup checks among 26,608 public call/release records. Every authored
sample retains its texel under ±1/16-pixel displacement in both axes. It uses
`sum(b*U/w)/sum(b*Q/w)` and the corresponding V quotient independently of
production matrix or renderer helpers.

## Preflight, exact inputs and custody

Before staging, assigned-box exec verified both runtime paths, retained
Puppeteer 24.31.0, no Chrome, and healthy fully hydrated runtime. Under the
local build lock, exact current modules were transferred directly into runtime
`build/` paths, with hashes checked before/after. Neither modules nor media
were copied into evidence. Existing calc input and dependency paths/hashes
are recorded in the seal. Changed small helpers were transferred individually.

| Module | SHA-256 |
| --- | --- |
| canonical | `b70c420e0a29c8664df1c3ed8b8074b590c342ed2a60078172b30e90922800cf` |
| compat | `4771c78ba2cc1b84875e1e90a743f7fa624975764607c3d86a516fbcd1cd5d00` |

CJS/ESM Puppeteer imports, both module validations, actual public COM bootstrap,
HTTP served hashes/isolation and all 48 pins passed before Chrome, including
a separate successful `--preflight`. Cache graph verification passes locally
(98 page / 13 Worker scripts). The serialized full build and E2E classification
checks are recorded in the run. The new browser test is explicitly registered
in `tools/test-tiers.js` so the ordinary unit tier does not launch Chrome.

The sole Chrome 151 process PID 12444 opened at 14:04:09.435Z and closed at
14:04:53.382Z, ahead of the fixed 14:27Z hard close. CDP reports SwiftShader;
the context reports Intel/Mesa. This conflicting identity does not qualify
physical hardware. Closed inspection found no Chrome, HTTP port 42309 closed,
and all 48 runtime pins unchanged. Six unique closed log/result/seal files were
recovered and SHA verified against an identical second remote inventory.
The large result was gzip-compressed only after exact roundtrip verification.

Assigned `bx_vvqgqtk6` is left **RUNNING / API idle**, healthy and fully
hydrated, expiry **2026-11-04T14:41:01.315Z**. Custody returned at 14:06Z;
the coordinator owns normal stop at 14:37Z. No lifecycle operation, other box,
local Chrome, subworker, game, deployment or timer extension occurred.

Recovery uses Git SHA, relevant binary diff and owned new-file patches; there
is no source archive or duplicated media/module evidence. PROJECTED remains
unadvertised. COUNT2, clipping, nonrigid normals, strided generation, native
ProcessVertices output, native Windows, full27 and gameplay remain unqualified.
Next is separately scoped native ProcessVertices evidence or a distinct
demonstrated supported rendering failure; this single task stops here.
