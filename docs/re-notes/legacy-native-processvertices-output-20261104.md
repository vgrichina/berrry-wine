# Public D3D7 ProcessVertices to Lock: generated normal/reflection output

2026-11-04. Evidence: `scratch/runs/20261104-legacy-native-processvertices-output/`.
Starting Git revision is recorded in `start-sha.txt`. This follows accepted
`e6a787467` and `3a4741b58` without rerunning either rendered/GPU suite.

The actual shipped canonical and compatibility modules both produce the
independently expected normal/reflection UV values through public D3D7
vertex-buffer ProcessVertices and destination Lock. No supported-path defect
was demonstrated, so there is **no production repair or WAT ownership claim**.
“Native” here means the module's real method, reached through its published
COM/x86 vtable; it does not mean a native Windows execution or comparison.

## Concrete output and supported boundary

Source is XYZ|NORMAL with mixed FLOAT1/3/4 supplied texture sets, or no supplied
texture sets. Destination is XYZRHW with three FLOAT2 sets for the ordinary
cases. Source index one and destination index two are nonzero. The operation
processes three vertices, leaving two prefix vertices and one suffix vertex
untouched. Independent world/view/projection expectations give screen
positions `(0,0)`, `(32,0)`, `(0,32)`, depth `1/2` and RHW `1,4/5,2/3`.

The authored rigid world/view transforms produce camera normals
`(-4/5,3/5,0)`, `(-3/5,0,4/5)`, `(0,4/5,3/5)`. Camera positions are
`(-1,1,1/2)`, `(5/4,5/4,5/8)`, `(-3/2,-3/2,3/4)`. Their exact lengths are
`3/2,15/8,9/4`. With the unit eye vector V directed toward the camera,
`R=2*(N.V)*N-V` gives reflection vectors
`(62/75,-34/75,1/3)`, `(38/75,2/3,41/75)`, `(-2/3,-2/15,11/15)`.

Disabled texture transformation writes generated x,y. Ordinary COUNT2 writes
`U=x/4+z/8+1/2`, `V=y/4+z/4+3/8`. For example the first normal becomes
`(-.8,.6)` when disabled, or `(.3,.525)` with COUNT2. First reflection becomes
`(62/75,-34/75)` when disabled, or `(449/600,69/200)` with COUNT2.
These pairs are written into **every declared destination set**. Changing the
selector's low word among 0,2,7 does not change generated output. This is an
observed implementation property, not proof of Windows output-set allocation
semantics. Public texture-state and matrix Get calls verify the states used.

FLOAT1/2/3/4 destination characterization establishes the exact limitation:
FLOAT1 truncates to U; FLOAT2 writes U,V; FLOAT3 writes U,V,0; FLOAT4 writes
U,V,0,1. COUNT3/4 changes neither this pair nor the higher-component defaults
for the tested nonprojected matrix. The matrix has deliberately nonzero z/w
output terms; they are not preserved in Lock output. Source inspection explains
this result: `d3dim_prepare_draw_vertex` emits a canonical TL UV pair, and
`d3dim_vb_copy_texcoords` copies that pair to each destination set with its
existing absent-component defaults. The native method cannot express full
generated XYZ/Q output through that representation. The test characterizes
this boundary instead of replacing the producer with host calculations or
declaring unestablished D3D8/9-style semantics to be a D3D7 defect.

## Verification

`test/test-legacy-native-processvertices-output.js` reuses accepted fixture
bootstrap plumbing only. DirectDrawCreateEx, QI D3D7, CreateSurface,
CreateDevice, transforms, stage/render state, CreateVertexBuffer, Lock/Unlock,
ProcessVertices and Release use real public x86 vtable calls on the shipped
module. There are no test-only WAT exports, draw calls, renderer substitution,
GPU, Worker runtime or browser launch.

Each module passes 35 cases: 24 ordinary cases cover both generation modes,
selectors 0/2/7, disabled/COUNT2 and vertex operations TRANSFORM (1) and
TRANSFORM|LIGHT (0x401); eight cases characterize FLOAT1–4 destinations with
disabled/COUNT2/3/4; two omit all supplied texture sets; one doubles reflection
normals and enables NORMALIZENORMALS. Method dwFlags is zero throughout.
This does not qualify independent lighting colors or all vertex-operation bits.

Across both modules:

* 70 successful processing calls and public destination Lock observations,
  including 1,428 texture components and 840 position components.
* Complete source allocations compare unchanged through public source Lock.
  Destination prefix/suffix bytes remain exactly 0xcd. Descriptor and pointer
  output canaries remain intact. Live selector/flags/texture-matrix changes
  after processing do not change the stored output.
* 280 guard calls cover zero count, source/destination end and null source;
  each leaves the entire destination unchanged and returns its checked result.
* 3,044 explicit public-call checks verify bounded completion, stdcall cleanup,
  caller RET and stack canaries on both sides of the used stack area. The
  12 additional release summary records are not counted as explicit checks.
* Three faulty public-input controls successfully process but fail the numeric
  output oracle: zeroed normals, identity texture matrix and normal generation
  substituted for reflection. These are harness discrimination evidence, not
  production failures.

The separate Python Fraction audit derives world/view normals and positions,
unit eye vectors, reflection, projection and texture expressions independently
of the JS oracle. It verifies all 70 complete expected byte arrays, all 2,268
observed float values at tolerance 2e-6, stack checks and unchanged sources.
Nonwritten bytes compare exactly. `audit.py` and `audit.json` are retained.
The Node test also passes without an evidence environment variable and creates
no artifacts in that mode; its filename places it in the ordinary unit tier.

The initial harness authored opposite x/y normal signs; its oracle rejection
is retained under `baseline/` and is **not a production baseline failure**.
Correcting the authored normals to the accepted geometry passes. The first
compat path used a hyphen instead of the shipped dot filename and did not
execute that variant; final results use the correct path below. No production
file was edited during either harness correction.

| Module path | SHA-256 |
| --- | --- |
| `build/wine-assembly.wasm` | `b70c420e0a29c8664df1c3ed8b8074b590c342ed2a60078172b30e90922800cf` |
| `build/wine-assembly.compat.wasm` | `4771c78ba2cc1b84875e1e90a743f7fa624975764607c3d86a516fbcd1cd5d00` |

The serialized `flock /tmp/wine-build.lock bash tools/build.sh` passes
(`build-final.log`), and the final public-COM tests and Fraction audit pass
again against its output. Module hashes remain unchanged. An earlier build
stopped on a concurrent SoftDrv observer's missing census registration; its
owner fixed that entry. This worker did not edit any Deus file.

## Limits and recovery

This verifies the module's public native output for finite rigid transforms,
XYZ|NORMAL input, uncolored XYZRHW destinations, unit normals or explicitly
normalized reflection normals, LOCALVIEWER TRUE, and the listed operations
with dwFlags zero. Generated z/w, colored-source packing, missing normals,
nonrigid/inverse-transpose normals, nonfinite/zero-vector semantics, clipping,
other operation/dwFlags behavior, strided input, native Windows parity and
application gameplay remain unqualified. PROJECTED is not exercised or
advertised. Prior rendered acceptance is referenced, not rerun or expanded.

Recovery uses exact Git SHA plus relevant binary diff and owned new-file
patches. `input-references.json` pins existing module/media/fixture paths and
hashes; there are no source archives, copied modules or copied media. No game,
remote runtime/API, box allocation, subworker, deployment, approval flow or
lifecycle action occurred. No box was assigned: ID/state/expiry are not
applicable, and coordinator lifecycle ownership remains unchanged.

Next prerequisite for changing dimensional native output is a supported-path
contract or native Windows D3D7 ProcessVertices-to-Lock reference that settles
generated output-set/dimensional semantics. No speculative producer fix is
justified by these passing UV results. This single task stops here.
