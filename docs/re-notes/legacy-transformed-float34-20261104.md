# Device7 supplied FLOAT3/4 texture transforms

Implemented on 2026-11-04. Evidence is retained in
`scratch/runs/20261104-legacy-transformed-float34/`; the test is
`test/test-legacy-transformed-float34.js`. This closes the supplied FLOAT3/4
immediate/indexed transform gap identified in
`legacy-coordinate-dimensions-20261104.md`, including queued draws. It does
not advertise PROJECTED in capabilities or qualify the remaining 27-app scope.

## Demonstrated defect and implementation

The predecessor actual WASM, SHA-256
`7d096ed4ae107f8a062fb1ffd725b80ef6a0aab9f29f6d8e5764fe9fe45438e9`,
returned `0x80070057` for the first public FLOAT3 ordinary COUNT2 draw.
`predecessor-exec.json` and its retained log record that public COM execution;
the baseline is not inferred from source or a mock.

Device7 now extends its canonical TL input to 40 bytes when an untransformed,
supplied-coordinate draw enables a texture transform. The existing 24-byte
position/color header is followed by four raw texture floats. FLOAT1/2 retain
their existing missing-component defaults, FLOAT3 supplies z and defaults w
to one, and FLOAT4 supplies its actual w. The FVF decoder still validates mixed
strides and selectors, and the extension reads z/w from the selected original
set. Existing public legacy methods and their 32-byte layouts remain in use.

Internal type 5 carries projected inputs; type 6 carries ordinary transformed
inputs. Software, the command stream and GPU adapter understand their 40-byte
stride. Indexed draws expand the selected full records before using the shared
draw path. Clipping copies/interpolates all four raw components, using bounded
400-byte extended polygon scratch rather than overlapping the old state scratch.

Transforms consume the entire supplied vector. Ordinary COUNT2/3/4 retain
ordinary perspective interpolation with texture q=1. PROJECTED COUNT2/3/4
select the final requested output as divisor: y, z or w respectively. Both
numerators and that divisor reach interpolation; there is no per-vertex divide.
Geometric reciprocal w remains separate. A queued record owns its vertex bytes,
state and texture matrix. Projected matrix capture normalizes only the selected
divisor column; ordinary capture preserves the original matrix. Later matrix,
selector or flags mutations cannot change the pending draw.

## Execution and independent checks

The authored oracle evaluates full four-component matrix multiplication,
geometric w, rational interpolation and an analytic mip/color equation. The
separate Python Fraction audit checks recorded pixels against exact rational
inputs, rather than calling production texture-transform code. Cases include
nonzero z/w matrix rows, distinct divisors, two mixed layouts, selectors
0/1/2/3/7, ordinary and projected COUNT2/3/4, and mip levels 0/2/3.

| Execution | Result |
| --- | --- |
| Direct WebGL1/2, immediate/indexed (four cells) | 576 draws, 1,728 pixels |
| Owning Worker WebGL1/2, immediate/indexed (four cells) | 1,152 draws, 3,236 pixels; 288 held pairs |
| Actual WASM software, immediate/indexed, normal/physical native queue | 576 draws, 1,728 pixels |
| FLOAT1/2 disabled/projected regression | 504 pixel checks |
| Successful-draw semantic negative browser controls | 44 controls, 48 draws, 64 pixel observations |

All passed. Browser positives also reject 16 invalid selector/count calls.
Worker positives require the requested WebGL version, zero fallback/software
completion and zero backend errors. Direct cells check public Lock readback and
direct GL pixels with GL error zero. Physical queue inspection verifies owned
40-byte z/w records and captured matrices after live-state mutation. Five
software negative controls passed as well.

Negative controls submit successful public draws but deliberately drop z, drop
w, use the wrong FLOAT3 default, choose the wrong set or change the divisor.
Their independently expected pixels disagree as intended. Four additional
captured-matrix controls prove that replacing the held matrix changes pixels.
The final audit is `audit.json`: 1,728 positive browser draws and 4,964 pixel
observations. Raw browser JSON SHA-256 is
`6a10966388a438c6a8fb42705ccccc72832960c932313ff00b6f77b07c5aef83`;
`result.json.gz` is a lossless retained copy. Two recovered captures were viewed
directly: `capture-webgl-1-false.png` and `capture-worker-2-true.png`.

One Chrome/151.0.7922.108 session ran on leased `bx_6k76zbug`, opened
09:53:59.688Z and closed 10:04:36.173Z; its detached driver exited normally
at 10:04:42.683Z. There was no browser failure, reload or second browser.
At 10:02:20Z the owned Node driver inspector cached an expensive pure
`controls()` lookup, before any browser failure. The exact expression and
before/after control-plan SHA are retained in `running-controls-cache.json`
and `cache-running-controls.cjs`. The control plan remained
`c231dabd944ec243aa85b9f19635f4d23d306d3d5f153569b3e2b82eee62dd0f`.
After closure, the committed helper received equivalent memoization;
`cache-final-proof.json` verifies identical fixture, oracle, config and control
outputs. No production bytes or browser fixture changed during execution.

Preflight verified the CJS/ESM Puppeteer closure, module/import/cache graph,
HTTP bytes/isolation and actual COM bootstrap for both modules before Chrome.
The final locked build reproduces the tested modules:

* Normal: `c2106403fdac5e30cf52577089fb83c95714623caf8b97a88176a12e97786517`.
* Compatibility: `06bf6e6a1f10a6218ca56b8a7606806c414b720e825bf8f5e7def3b56f687ce3`.

New pixels were executed with the normal module; compatibility bootstrap is
not a claim of compatibility-module pixel coverage. Focused points, batching,
fallback counters, depthless behavior, command capture and fixed shader checks
passed. An initial misplaced interpolation edit failed compilation and was
corrected before runtime; subsequent full builds passed. An initial local
control-helper invocation used a non-exported function; the corrected isolated
helper check passed. These failures are retained in the logs.

## Reuse, custody and limits

`reused-evidence.json` verifies the exact retained predecessor closure (75
artifacts, eight positive cells, 1,024 draws, 2,960 pixels) and captured-matrix
closure (44 artifacts, linking the accepted sixteen-matrix/36-fault evidence).
These are historical results by exact SHA, not reruns or new-module results.
The predecessor raw result SHA is
`543bad998c887631aee31557baf3973715b698c7449d7859136c43efedcd4fc8`;
the captured remaining-fault result SHA is
`d7c16d717a7d13aaa7671c706b09be8e02227244280394d1462ff53d837d7213`.

All 25 remote artifacts were recovered and hash verified before the recovery
deadline. The driver and Chrome are absent, HTTP listener closed and all 46
runtime pins unchanged. The leased box is left RUNNING (last API state idle,
healthy/hydrated), expiry `2026-11-04T10:20:16.584Z`; shutdown ownership returns
to the coordinator. No lifecycle action was taken.

Git SHA plus relevant binary diffs and patches for owned new files preserve
source provenance. Modules are referenced by retained path and SHA; no source
tree, scratch/docs/test-binary archive or repeated game media was staged.
PROJECTED remains unadvertised pending the full relevant contract. Generated
coordinates, dimensional vertex buffers/strided/ProcessVertices paths, COUNT1,
singular divisors, physical hardware and the broader application matrix remain
unqualified by this assignment.
