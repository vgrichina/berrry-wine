# Public ProcessVertices dimensional texture-set preservation

Implemented 2026-11-04, starting at main
`2e958d0dc7cc5e76df0364532979f19a1da20604`. Evidence:
`scratch/runs/20261104-legacy-processvertices-dimensional/`. Public regression:
`test/test-legacy-processvertices-dimensional.js` (e2e tier).

## Demonstrated predecessor failure

The actual accepted normal module, SHA-256
`0b99df572d10ad7d2ca4c3d88dbe0e3b03cc24b607a9481654e08570d51e6b20`,
was executed before compiling the repair. Public DirectDrawCreateEx, QI,
CreateVertexBuffer7, Lock/Unlock, ProcessVertices7 and VB draw calls dereference
the published COM vtables and execute their x86 thunks. Each call checks stack
cleanup. Source FVF includes XYZ/point-size/diffuse/specular; destination FVF
includes XYZRHW/diffuse, with independently laid-out mixed texture dimensions.

`baseline/first-failure.json` records the first byte mismatch: destination byte
324 was 0 instead of 49. `baseline-pixel.json` records a separate draw with the
byte assertion bypassed to observe its consequence. The successful public
FLOAT3 set-2 draw at (5,6) produced RGB `[20,70,65]`, versus independently
expected `[60,25,65]`. Both failures name the accepted module SHA. Expected
bytes and the analytic pixel equation were authored before the producer edit.

ProcessVertices packed one selected UV pair into a canonical 32-byte vertex,
then replicated that pair into every output set at fixed eight-byte intervals.
This lost unrelated sets and FLOAT3/4 components; FLOAT1 also made those writes
land at incorrect offsets. The accepted VB draw fix alone could not recover
the destroyed producer output.

## Bounded producer repair

Position, normals, lighting, diffuse and specular still use the existing
canonical pack/prepare/unpack path. Texture output now copies each original
set separately, using source and destination FVF component counts and offsets.
Destination components absent from the source use the established supplied
vector defaults, zero for x/y/z and one for w. Truncation does not read beyond
the source set. Invalid texture-set counts above eight return E_INVALIDARG
before conversion. Generated-coordinate selectors retain the existing
canonical generated UV route; there is no new generation capability.

The existing source/destination capacity clamps precede all reads and writes.
When both objects use the same allocation, a temporary copy preserves the
original source records across overlapping output ranges. Allocation failures
release temporary storage. The shared producer serves both legacy and v7
entrypoints. No draw representation, capability advertisement, PROJECTED,
cube-map or BORDER support was added.

## Verification

`final-complete/` contains four actual normal-module software cells: ordinary
and indexed VB draws, each immediate and through the physical native Worker
queue. Each cell draws 23 states: two mixed layouts, selected sets 0/1/2/3/7,
FLOAT1–4, constant/varying geometric w, differing destination dimensions, and
missing source sets. Source index two and destination index three are nonzero.
Both source-limited and destination-limited calls pass count `0xffffffff`.
Indexed draws fetch 3/0/2 from a pool with a deliberately distinct extra record.

* 92 successful public draws, 276 analytic pixel checks and 92 independently
  authored complete destination-byte arrays pass. Position comparisons allow
  float rounding; texture, color and untouched prefix/suffix bytes are exact.
* 368 zero-count/end-index/null-source guards and 184 invalid source/destination
  texture-count rejections preserve the complete valid destination allocation.
  Each positive checks that the full source remains unchanged.
* 92 additional public calls shift overlapping ranges forward in the same VB;
  every output set retains its original pre-call components.
* 46 queued records are held before delivery. Public destination Lock/Unlock
  overwrites the live VB, indices are overwritten, and selector/matrix/state
  change. Owned type-3 records retain the selected processed UV bytes and
  reproduce the original pixels after delivery.
* Four semantic negative controls successfully call ProcessVertices but drop
  supplied z/w or draw with a wrong selector/index list. The unchanged byte or
  pixel oracle rejects each control.

`audit.py` independently lays out all destination bytes with Python struct
packing and checks all pixels with the accepted exact Fraction equation. It
also verifies public call arguments/results/stack cleanup and exact SHA/size
of seven accepted direct/VB artifacts, including the accepted direct raw
result SHA `6a10966388a438c6a8fb42705ccccc72832960c932313ff00b6f77b07c5aef83`.
Those historical direct/browser/GPU results are reused by hash, not rerun or
claimed for this module. An initial audit included a bootstrap record without
stack fields; restricting that assertion to recorded stack-bearing calls
corrected the audit. Its failed log is retained.

Two full serialized `flock /tmp/wine-build.lock bash tools/build.sh` runs pass.
The final normal module SHA is
`b748d9b5a16631762be84a6e1017ca095c192623bc288657488157d32f79c0ca`;
compatibility build SHA is
`cafdf1fd380aadb73571c68fbd77612ba91d58178a05a6afc469ae858394c333`.
Focused existing tests pass: `test-d3dim-process-vertices.js` (both stdcall
aliases, position/color/UV/clamps), `test-d3dim-process-vertices-fog.js`,
`test-d3dim-texgen-camera-position.js`, and
`test-d3dim-v3-vertex-buffer-draw.js` (900 indexed pixels).

## Limits and evidence recovery

These public dimensional cells use supplied coordinates, disabled texture
transforms and XYZRHW output. FLOAT3/4 components are checked in public Lock
readback; the subsequent TL draw and its immutable queue record consume UV.
This does not establish a dimensional texture-transform contract for already
transformed ProcessVertices output. Generated-dimensional outputs, strided
inputs, physical GPU/application coverage and broader ProcessVertices flags
remain unqualified. The next gap is that transformed-output texture-transform
contract. Existing generated UV arithmetic has its focused regression; no new
generated pixel result is claimed here.

The historical coordinate-dimensions test is imported only for its immutable
plan. Its stale FLOAT3/4 rejection postlude was neither needed nor edited.
No Chrome, remote allocation/runtime/lifecycle action, box, game media,
deployment, worker or successor was used or assigned.

Git commit SHA plus relevant `git diff --binary` and small new-file patches
preserve source provenance. Module/dependency paths and hashes identify inputs;
rebuild from the recorded Git revision and patch with `tools/build.sh` to
recover module bytes. Closed large logs/JSON are gzip compressed with verified
roundtrip SHA; the compression index and artifact seal preserve exact recovery.
No source archive, repeated module or media copy was made.
