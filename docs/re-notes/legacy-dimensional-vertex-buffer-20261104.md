# Supplied FLOAT3/4 through public legacy vertex buffers

Implemented 2026-11-04. Evidence:
`scratch/runs/20261104-legacy-dimensional-vertex-buffer/`. Regression:
`test/test-legacy-dimensional-vertex-buffer.js` (explicit e2e tier).

## First demonstrated defect

Main already contained `4ef1febf63a37350fe3889da5b406084b224672c` and its
immediate FVF dimensional repair. The actual predecessor module at
`build/wine-assembly.wasm`, SHA-256
`c2106403fdac5e30cf52577089fb83c95714623caf8b97a88176a12e97786517`,
still lost supplied z/w through the public VB route.

`baseline-semantic/first-failure.json` records actual x86 COM execution:
DirectDrawCreateEx, QI IDirect3D7, CreateVertexBuffer7, Lock/Unlock and
DrawPrimitiveVB7, dereferencing the published vtables. The first mixed-layout
FLOAT3 set 2, ordinary COUNT2 draw returned S_OK with correct stdcall cleanup.
Pixel (5,5) was RGB `[60,70,30]`; the independently authored matrix,
interpolation and texture equation expected `[60,25,65]`. This is the exact
accepted direct-path module, not a reconstructed predecessor.

Both VB draw functions packed the selected coordinates into a 32-byte record,
discarding z/w, and bypassed the immediate path's 40-byte supplied-vector
conversion. ProcessVertices was not needed to expose this first defect.

## Repair and regression

The two shared VB draw functions now validate the supplied selector/FVF and
reuse `d3dim_d7_supplied_type` / `d3dim_d7_supplied_vertices` for untransformed
draws with enabled texture transforms. The original source pointer includes
the start-vertex offset. Existing clamping, indexed scan, lighting, expansion,
queue ownership, matrix capture and rasterization remain the shared machinery.
There is no new rendering representation or capability advertisement.

The regression reuses the exact accepted fixture setup and analytic oracle
from `test-legacy-transformed-float34.js`, replacing submissions with public
VB calls. All buffers are created, locked and unlocked through COM. Two
poisoned records precede the start offset of two. Indexed cases store
v1,poison,v2,v0 and fetch indices 3,0,2. Queued indexed cases pass `0xffffffff` as the vertex
count to exercise capacity clamping and the highest-index scan.

| Final execution | Draws | Pixel assertions |
| --- | ---: | ---: |
| FLOAT3/4 software, ordinary/indexed | 288 | 864 |
| FLOAT3/4 physical native Worker queue, ordinary/indexed | 288 | 864 |
| FLOAT1/2 defaults and disabled FLOAT1–4 transforms, ordinary/indexed | 184 | 552 |
| Total | 760 | 2,280 |

Coverage includes two mixed dimensional layouts, selected sets 0/1/2/3/7,
ordinary and projected COUNT2/3/4, varying geometric w, and mip levels 0/2/3.
The physical queue is held before delivery. Public VB Lock/Unlock overwrites
its live bytes, index bytes are overwritten, and selector/flags/matrix change
before replay. All 288 captured records retain all four selected components,
the FLOAT3 w=1 default, the captured matrix and the expected pixels.

Each of six positive cells also checks eight no-draw guard calls (past-end,
zero count, null VB, null indices and out-of-range index), all 1,024 unchanged
clear pixels, the unchanged full VB and two E_INVALIDARG selector/count cases.
Six successful public VB draws with deliberately wrong selector, z, w,
missing-w default, matrix component or indices fail the unchanged pixel oracle.

`audit.py` independently applies the accepted Python Fraction equation to all
2,280 final pixels. It verifies exact SHA/size of the accepted direct evidence
and fixture rather than rerunning or claiming new direct/GPU coverage. The
accepted compressed result SHA is
`4627d5de45b758d486f4b1ca7a358844b1f2590a44279c8e875e6dacc812ac9c`;
its uncompressed SHA is
`6a10966388a438c6a8fb42705ccccc72832960c932313ff00b6f77b07c5aef83`.
The original direct evidence remains at
`scratch/runs/20261104-legacy-transformed-float34/`.

## Checks and limits

Two serialized `flock /tmp/wine-build.lock bash tools/build.sh` runs passed.
The final normal module SHA is
`0b99df572d10ad7d2ca4c3d88dbe0e3b03cc24b607a9481654e08570d51e6b20`.
`test-d3dim-v3-vertex-buffer-draw.js` passes (900 indexed pixels), as does
`test-d3d-legacy-vertex-matrix.js`. Tier membership and owned diff checks pass.

`test-legacy-coordinate-dimensions.js --offline` reaches its historical
assertion that transformed FLOAT3/4 must return E_INVALIDARG and fails because
the accepted immediate repair correctly returns S_OK. Its positive pixels
precede that assertion; this is not claimed as a passing suite. The owned new
test uses the accepted successor oracle and tests FLOAT1/2 plus disabled
FLOAT3/4 through VB. The historical file was not edited. Logs also preserve
an initial fixture slot-number error, a missing output-directory error, and
an audit filename mismatch, all corrected before final validation.

No Chrome, remote box, lifecycle action, deployment or game media was used.
No new compatibility-module pixels or WebGL pixels are claimed. The shared
Device3 VB entrypoints retain their existing focused regression, but the new
dimensional COM cells use Device7. ProcessVertices, strided/generated
coordinates, COUNT1, singular divisors, physical hardware and application
coverage remain unqualified. In particular the ProcessVertices producer still
needs its own dimensional/multiple-set investigation; this repair does not
claim to preserve those producer outputs. PROJECTED, cube and BORDER remain
unadvertised.

Git SHA, owned binary diffs/new-file patches, dependency/module path hashes,
losslessly compressed closed logs and an artifact seal are retained in the
run. No source tree or repeated module/media snapshot is included.
