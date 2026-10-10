# Dual Direct3D implementation ledger

Reset presentation follow-up48855 PASS: native56-byte parameter extent guard,
one-buffer DISCARD/COPY selection, explicit rejection of FLIP/multiple buffers,
MSAA and unsupported flags, windowed client-size defaults, and fullscreen
resolution/refresh validation against the existing enumerated60Hz modes.
Fullscreen host resizing and virtual display updates occur after actual backend
completion; returning windowed restores the captured desktop dimensions. Direct
and production-worker tests retain failed-Reset target ownership and lost state.
GPU Reset also retargets its compositor window only after successful completion.

Presentation cadence now uses the same queue and render-wait tokens for both
backends: DEFAULT/ONE wait for a browser composition boundary, limited to one
per virtual60Hz period; CLI uses a virtual60Hz timer. IMMEDIATE remains synchronous
when its executor is synchronous. This implements an emulated display cadence,
not physical scanline/beam-following. `test-d3d9-present-cadence.js` verifies
ordering/cancellation/lease retirement; real GPU browser89447 verifies queued
red/blue pixels and genuine completion. Legacy synchronous pixel fixtures now
request IMMEDIATE explicitly. See the
[presentation parameter contract](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dpresent-parameters)
and [interval semantics](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dpresent).

## Current integration checkpoint

Independent color-target checkpoint: native standalone color surfaces
own canonical pixels and separate external/internal references; the bound RT0
does not replace the implicit backbuffer. Implemented APIs include bounded
A8R8G8B8/X8R8G8B8 CreateRenderTarget/CreateOffscreenPlainSurface, RT0 Set/Get,
GetDesc/GetDevice, lockable-surface LockRect/UnlockRect with subrect addressing,
and matching-format GetRenderTargetData to a system-memory surface. Binding
resets viewport/scissor dimensions; externally held default-pool surfaces block
Reset, while internally bound surfaces retire with Reset/device destruction.
Unsupported multisampling, formats and lock flags fail explicitly.

Native direct/worker86852 PASS: independent Clear and actual DrawPrimitiveUP,
Lock readback/Unlock upload, A/B content preservation, implicit backbuffer
Present and GetRenderTargetData even with B bound, validation, reference recovery,
Reset and final-child device release. The fixture uses the production host
import route; routing now includes previously omitted depth/Reset/query commands
and the new color operations. Async protocol verifies all18 private opcodes.
Existing COM21353, Reset39222, viewport94591, WebGL Present11654 and depth99511
pass. Full build65981 passes1150963/1151431 bytes. Browser52209 passes actual
x86 CreateRenderTarget/SetRenderTarget/Draw/Clear/Lock/Unlock/Present/Release in
cooperative and guest-main Worker modes, with canonical pixels and native heap
retirement. Initial browser57496 exposed the second stale routing boundary in
the guest-worker broker (LockRect trapped as unknown GL opcode196624); extending
that broker through30012 resolves it. Executor24083 passes22 cases in both
direct and production-worker software; GPU67695 passes22 cases per WebGL version
plus forced allocation-failure cleanup/retry. The detailed executor entry below
records storage/copy costs. These fixtures do not establish native-driver
raster/format conformance or complete resource-profile coverage.

This is not full render-target/resource completion. Texture-level/cube-face
render-target binding and sampling aliases, resource-version leases for those
aliases, MRT/MSAA, remaining formats/lock flags, GetDC and copy/resolve operations
remain open. The executor currently synchronizes standalone color surfaces at
explicit lock/readback/upload boundaries; no CPU shadow is claimed current while
backend work is pending. Shader-profile and capability claims are unchanged.

Scissor executor checkpoint: native51017 and independent73298 PASS15
point/wire/solid cases, depth/stencil/query exclusion, copied rectangle ownership,
invalid-bind preservation and late-bind rejection. WebGL2504 and independent6215
PASS20 cases across WebGL1 solid and WebGL2 solid/point/wire, including top-row,
right-column, empty and disabled rectangles. Software retains shader/helper
execution and rejects output before alpha/depth/stencil/query effects; that
ordering is source-reviewed, not a dedicated derivative pixel fixture. GPU
scissor uses the actual attachment height for its Y conversion. Manifest and
logical-operand gates pass. Native Windows raster conformance remains separate
from agreement with each backend's unscissored baseline.

Scissor frontend/state checkpoint70190 PASS: real Set/GetScissorRect with
owned RECT bytes, pointer/ordering/target-bound validation, a distinct explicit
empty-rectangle state, independent render-state enable, and selective
record/Capture/Apply. Reset27538 passes direct/worker paths: failed Reset retains
the rectangle and successful Reset restores the resized full-target default.
Async snapshots retain rectangle coordinates across immediate guest reuse.
Real COM51349 passes scissored lit draw, Clear, exclusive edges, empty regions
and enable/disable through the canonical framebuffer. Clear normalization
intersects explicit regions with viewport and scissor before the shared queue;
the legacy no-backend Clear rejects enabled scissoring rather than ignoring it.
Browser57824 passes actual x86 scissored Draw and Clear in cooperative and
guest-main Worker modes through the render Worker, including canonical pixels
and allocation retirement. Full build69313 passes1148824/1149292 bytes.
These semantics follow Microsoft's
[scissor-test contract](https://learn.microsoft.com/en-us/windows/win32/direct3d9/scissor-test).
SetRenderTarget was still an open API/resource gate at this scissor checkpoint;
the newer standalone-color slice above implements its RT0 reset side effects,
with texture aliases and wider target support still incomplete.

Viewport state-block prerequisite95990 PASS: `SetViewport` now records owned
24-byte values without changing live state; repeated writes retain the last
valid value. Capture/Apply, untouched live getters, unrecorded-state preservation
and null/wrapped/unmapped-pointer rejection have focused native coverage.
Existing selective-block suite39847 also passes. Real COM82253 proves that
recording leaves coverage unchanged and Apply moves the lit triangle into the
recorded viewport. Combined build51597 passes canonical1146581/compat1147049;
browser20945 passes cooperative and guest-main Worker paths with the software
render Worker, default packet cache and per-app experimental profile selection.
An earlier sandbox browser65745 stopped at navigation timeout before guest
launch; the successful retry used a fresh matched canonical snapshot.
This follows the documented
[recordable state methods](https://learn.microsoft.com/en-us/windows/win32/api/d3d9/nf-d3d9-idirect3ddevice9-beginstateblock).
Full typed ALL/PIXEL/VERTEX creation remains an open gate; palette,
clip-plane and other missing categories are not silently claimed by this change.

Directional-lighting state checkpoint: native material/light state15817 PASS
replaces silent-success setters and trapping getters. Device storage appends a
68-byte material and a linked list keyed by arbitrary DWORD light indices;
SetLight stores point/spot/directional definitions without enabling them.
LightEnable on an unknown index creates the documented white +Z directional
default. Material defaults to all zero, and D3D9 lighting/material-source render
state defaults are initialized explicitly. These follow Microsoft's
[material defaults](https://learn.microsoft.com/en-us/windows/win32/direct3d9/materials)
and [LightEnable contract](https://learn.microsoft.com/en-us/windows/win32/api/d3d9/nf-d3d9-idirect3ddevice9-lightenable).
Selective Begin/End blocks record material, light definitions and enables
independently; Capture/Apply and detached allocation retirement pass. The existing
CreateStateBlock ALL/PIXEL/VERTEX entry remains fail-loud and is not claimed here.
Reset60956 PASS on direct/worker paths: invalid Reset preserves the state and
successful Reset frees old light nodes and restores zero material. Async command
tests verify material, source selectors and all enabled-light fields survive
immediate guest-memory reuse. Point/spot/specular/skinning and caps remain
separate gates. Full build87107 PASS (canonical1145409, compat1145877).
Real-COM software60530 PASS includes directional diffuse, light disable,
emissive material and actual PS1.1 v0 linkage through canonical framebuffer
pixels. Native D3DX font50352 and browser WebGL2 font43660 still render863
white pixels with the newly initialized lighting defaults.

Native D3DX font integration12873 PASS on the software worker: the supplied
Microsoft d3dx9_25.dll renders readable “Black & White 2” into the canonical
frame (863 white pixels), versus zero text pixels on the previous build.
Native Win98 oracle54317 establishes NULL-rectangle and ANSI WORD glyph-index
semantics; direct TrueType indexing now uses the shared native glyph cache and
text compositor. Glyph81042, clipping38966 and text extent87637 pass.
Bitmap-font indexed output remains unsupported. Actual browser guest/WebGL2
native-font integration31600 also PASS with863 white pixels and GL error0;
the resulting text was visually verified. Fresh full-game gameplay remains
unverified; see the B&W RE notes and `tools/d3dx-font-probe.js` /
`tools/d3dx-font-web-probe.js` for reproduction.

WebGL table fog14166 PASS on WebGL1/2: EXP/EXP2/LINEAR use
`gl_FragCoord.z` after interpolation, supersede vertex fog, preserve alpha,
and support fixed stages and VS1.1/PS1.1–1.3 without requiring oFog.
Uniform changes reuse programs. W-depth, outline/table combinations and
shader depth replacement/table combinations remain explicit conformance gates;
invalid modes, nonfinite parameters and equal linear endpoints reject.
Full GPU shader regression35300 PASS after this integration. Earlier entries
below are chronological checkpoints, not additional current table-fog gaps.

Native table fog77857 PASS: EXP/EXP2/LINEAR use original, unquantized
interpolated device Z with fixed stages or VS1.1/PS1.1–1.3, before framebuffer
blending and without changing alpha/discard. Pixel mode takes precedence over
vertex formulas/oFog and does not use RANGEFOGENABLE. Shared fogState now also
copies start/end/density/depthMode; production depthMode is0 (device Z), since
WFOG remains unadvertised. This follows Microsoft's
[pixel fog depth selection](https://learn.microsoft.com/en-us/windows/win32/direct3d9/pixel-fog)
and [fog precedence](https://learn.microsoft.com/en-us/windows/win32/direct3d9/fog-state).
Raster28544 PASS339 includes a private mode1 binder test proving reciprocal
interpolated RHW, not interpolated W; that mode is not enabled by the host.
Copied table state is immutable after execution, invalid rebinds are atomic,
switching to vertex/disabled fog retires it, and context destruction frees it;
native peak allocation reservation includes the32-byte owned state. Wire depth
also has actual pixel coverage. PSIZE73321, real COM53833, async snapshot and
logical/diff checks PASS. Equal linear endpoints, shader-written depth plus
table fog, PS1.4 and pixel-v1 linkage remain explicit gates. Microsoft prose
differs on programmed-VS/table interaction; this uses pixel-mode precedence,
not a claim of exhaustive Windows-driver conformance. Caps remain unchanged.

GPU COLORWRITEENABLE76707 PASS WebGL1/2 all16 RGBA masks and invalid-mask
rejection before pixel mutation. Captured real-game replay exposed the missing
per-draw color mask: software47696 and WebGL32402 now differ beyond tolerance2
in only1/480000 RGBA pixels (max33). Both reproduce the malformed panel;
cross-backend agreement is not guest correctness. Shared fogState native28275,
snapshot and COM39084 tests also pass; full shader regression84318 passes.

Native both-programmed fog28275 PASS: every DRAW now carries independent
`fogState={enabled,color,tableMode}` even when both shader bindings omit the
fixed-stage descriptor. VS1.1 oFog plus actual PS1.1–1.3 pixel output receives
RGB-only raster fog before framebuffer blending; alpha testing/discard and
alpha preservation are verified. Missing oFog, table fog, PS1.4 and pixel v1
linkage remain explicit gates. Shared state is authoritative even when disabled;
legacy direct-fixture fixedFunction fog remains a fallback. Async snapshot tests
PASS both-programmed bindings and guest mutation of all three fields. Real
COM39084 regression PASS. No native VM/raster ABI or caps change.

Shared raster fog GPU72884 PASS on WebGL1/2 with both programmable stages:
VS1.1 oFog and PS1.1–1.3 work without a fixedFunction descriptor. The shared
`fogState={enabled,color,tableMode}` overrides legacy fields, including disabled
state. Tests verify scalar clamping, RGB color uniform updates without shader
recompilation, and post-shader alpha-test discard/accept. Mixed regression4829
PASS. Native/host shared-state tests are proceeding separately; table fog,
PS1.4 fog and specular input v1 fog linkage remain explicit gates.

Native vertex fog14247 PASS: fixed vertex LINEAR/EXP/EXP2, absolute camera Z
and range distance, supplied specular alpha (including POSITIONT), per-vertex
clamp/interpolation through clipping, six complete UV outputs, and RGB-only
post-shader fog. Alpha discard remains effective, alpha is unchanged and fog
precedes framebuffer blending. Both fixed PS and actual PS1.1–1.3 paths are covered. Public
VS1.1 oFog now validates/executes as scalar clamped x; programmed VS/fixed PS
uses it and rejects an absent oFog output. Raster33168 PASS335 includes public
oFog masks/read rejection and ignores yzw. Internal vertex stride is144,
context288; the descriptor128 and existing context fields remain unchanged.
Fog gets its own interpolated scalar, not a stolen texture/color component;
new cascade5 rows160 preserve all48/56/128/136 exports. Peak allocation bounds
include expanded clipping buffers and masks, now placed after both scratch
vertex arrays. Combined normal/reflection/fog lowering stays100/128 IR slots.
VM54918 PASS231, PSIZE37065 and real COM41919 PASS. Table fog,
PS1.4 fog and specular pixel input v1 remain gated. Equal linear start/end
rejects as a temporary compatibility gap; extreme nonfinite fog-distance
semantics still need a Windows reference. No caps expansion.

FixedVS/programmedPS vertex fog34374 PASS on WebGL1/2 for PS1.1–1.3.
Every existing supplied/computed/range/POSITIONT/varying-depth fog fixture now
also runs through an actual pixel shader, followed by RGB-only fog blending.
Alpha-test discard preserves the clear color, accepted pixels retain alpha,
and changing fog constants reuses shaders. Mixed regressions32300 PASS.
Table fog, PS1.4 fog, and fog with specular pixel input v1 remain explicit
gates pending their linkage conformance; this does not enable both-programmed
pipeline fog or expand native caps.

GPU VS1.1 oFog lowering29346 PASS with fixed pixel shading on WebGL1/2:
only x contributes, factors below0/above1 clamp, and fixed vertex fog mode is
ignored for a programmed VS. Missing oFog with fog enabled explicitly rejects.
This was direct browser backend evidence; the native validator/runtime
checkpoint above now also implements guest oFog.
Programmed pixel fog is not enabled by this change. Microsoft
[output register semantics](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-vs-registers-output)
define scalar consumption and clamping before rasterization.

Vertex fog GPU32531 PASS on WebGL1/2 (fixed VS + fixed PS): supplied specular
alpha, LINEAR/EXP/EXP2, absolute camera Z and range distance, POSITIONT supplied
factor, RGB-only blending, and uniform updates without shader recompilation.
A varying-depth triangle verifies per-vertex clamping before interpolation,
not evaluating the formula on interpolated depth. Host async snapshot regression
passes for all seven fog parameters after guest mutation; mixed-stage regression
29923 PASS. Based on Microsoft's [vertex fog](https://learn.microsoft.com/en-us/windows/win32/direct3d9/vertex-fog)
and [formulas](https://learn.microsoft.com/en-us/windows/win32/direct3d9/fog-formulas).
Native vertex fog is covered above. Table fog remains a gap;
equal linear start/end currently rejects rather than inventing a
division policy. No caps expansion or full fog-conformance claim.

Six simultaneous projected fixed-function stages13001 PASS on WebGL1/2:
COUNT3 and COUNT4 use distinct per-stage matrices and produce nonsaturated
RGB(48,96,0); changing only stage5 produces RGB(64,64,0) without a new shader
program. This covers combined varying linkage on the tested Chrome host, not
every WebGL1 device's varying limits or mixed-invalid-vertex interpolation.

Stage-local projection validation80278 PASS on WebGL1/2. Projection on t0 no
longer rejects unrelated instructions targeting an unprojected stage: actual
PS1.1 fixtures combine projected TEX t0 with TEXCOORD t1 and TEXREG2AR t1.
The latter consumes the projected sample result, not its original coordinates.
Projected dependent destinations remain explicitly rejected. This removes an
overbroad shader-wide gate without claiming dependent projected sampling.
The existing game run reached frame1571/finish1786 at3824seconds, all14380 queued
commands completed and zero reported failures; it is still the intro hold.

TEXCOORD64 alpha corrected in both GPU and native SIMD: the fourth component is
always1, not clamped incoming Q, per Microsoft's
[TEXCOORD contract](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/texcoord---ps).
GPU regression92047 first reproduced alpha64 instead of255; corrected73122 and
37991 pass on WebGL1/2 for PS1.1/1.2/1.3. Native VM52763 passes231 cases,
including varying Q and original-input retention after a prior register write.
The narrow09ag handler edit is balanced; logical42751 and diff checks pass.
GPU37991 additionally verifies TEXKILL with projected TEX: original negativeXYZ
discards even when divided UV would be positive, while negativeQ alone does not
discard, following the [TEXKILL coordinate rule](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/texkill---ps).
Projected TEXCOORD/dependent sampling remains gated pending separate semantics.
Full shader12964 passed initial GPU checks but stopped at canonical WAT parsing
while the native agent was editing. After the agent reported balanced source,
separate rerun89953 passed the full shader/mip/depth regression.

GPU normal/eye normalization now uses an explicit squared-length guard instead
of relying on GLSL `normalize(0)`. Nonpositive or nonfinite squared length yields
a zero vector; other inputs use inverse-square-root normalization. Transform-web
passes WebGL1/2 zero, underflow, overflow, infinity and NaN normal cases with
fixed PS and PS1.1/1.2/1.3 sampling. This is an emulator edge policy, not a claim
about Windows degenerate-vector behavior. Mixed90883 and diff checks pass.
The same helper is used for the reflection eye vector, but zero-eye geometry
and mixed invalid-vertex interpolation still need focused coverage.

Existing Black & White probe33057 remains live on its original artifact:
frame1342/finish1786 at3370seconds, fade255, zero reported render failures.
Root inspected `bw-software-probe-6cn5Lr/frame-3421.png`: intact Lionhead logo
and reflection, still the intro hold. This is not menu/gameplay acceptance and
does not validate the subsequently edited renderer sources.

GPU mixed projected TEX99347 PASS on WebGL1/2 for real PS1.1/1.2/1.3 bytecode.
COUNT3/4 division occurs at texture fetch after interpolation; the per-fragment
boundary fixture distinguishes vertex division. Zero/nonfinite/overflow cases
follow the explicit black-sample policy. Follow-up transform-web also verifies
projected TEXCOORD rejection preserves prior pixels. The backend passes private
projection metadata to the translator; fixed VS preserves all4 coordinates and
the validity varying. This follows the applicable profiles in Microsoft's
[projection flag contract](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dtexturetransformflags).
Other tex* instructions combined with projection, projected cubes, and later
profiles remain gated pending their semantics; this is not full projected-shader
conformance. Existing shader76233 regression passes, including programmable
bump, private PS1.4, matrix instructions, depth and mip sampling.

Generated fixed-VS/programmed-PS linkage60730 PASS on WebGL1/2: camera position,
camera normal, normalized normal, and both reflection viewer modes produce the
same sampled pixels as the fixed pixel path. Coordinate generation now uses a
single helper in both paths, followed by the shared texture-matrix lowering.
The programmed pixel fixture is actual PS1.1 bytecode, not a mock compiler.
Fixed bump11419 and async snapshot regressions pass after the refactor.
Projected programmable-pixel linkage and sphere-map generation remain gated;
broader shader-profile/component conformance still requires separate coverage.

Mixed fixed-VS/programmed-PS nonprojected texture transforms22806 PASS on
WebGL1/2: real PS1.1 sampling sees FLOAT2 coordinates transformed under
COUNT2/3/4. Matrix-value changes update pixels without creating shader variants.
Both fixed and programmed pixel paths now share the vertex texture-matrix
lowering helper. Mixed regression21795 passes after a sandbox-only Chrome
launch failure50331; diff checks pass. Projected or generated-coordinate linkage
into programmed pixel shaders remains gated and needs profile-specific tests.
This does not establish unused-coordinate-component conformance for all profiles.

GPU projected-coordinate edge policy18025 PASS: COUNT3/4 with zero, negative
zero, infinity, NaN or overflowing divided coordinates returns a transparent
black texture sample; finite negative divisors remain valid. Initial38138 failed
infinity handling because nonfinite vertex values could become finite during
varying interpolation. A pre-interpolation validity varying now retains that
information; invalid helper UVs are zeroed before unconditional texture sampling,
then invalid sample results are masked. This is an explicit emulator policy,
not Windows-reference conformance. Triangles mixing valid/invalid vertices,
cross-lane mip derivatives and extra-varying limits still require parity tests
against the native path; the current fixture uses constant invalid coordinates.

GPU reflection-coordinate generation4365 PASS on WebGL1/2, including both
LOCALVIEWER142 modes and actual +Z/-Z cube-face selection. Local mode uses the
normalized position-to-eye vector; distant mode uses (0,0,1). Both use the
camera normal and `2*dot(E,N)*N-E`, following Microsoft's
[cube-map reflection formulas](https://learn.microsoft.com/en-us/windows/win32/direct3d9/cubic-environment-mapping).
LOCALVIEWER is retained in immutable host snapshots (async regression PASS).
Existing explicit-direction cube regression95631 also passes48 cases.
Sphere-map generation, zero-length input edge semantics, mixed fixed/programmed
pixel linkage and native generated-normal/reflection parity remain open.

GPU camera-space-normal generation10949 PASS on WebGL1/2. A full4x4 world-view
inverse transpose supplies the3x3 normal transform; optional NORMALIZENORMALS143
normalizes afterward. Tests distinguish direct transformation from inverse
transpose under nonuniform world/view scales, verify a non-affine4x4 case that
would fail with3x3-only inversion, matrix-cache reuse, and singular rejection.
Async snapshot tests prove NORMALIZENORMALS survives guest mutation. This follows
[camera-space transformation rules](https://learn.microsoft.com/en-us/windows/win32/direct3d9/camera-space-transformations).
Normal input is required for this path; reflection generation, fixed/programmed
pixel linkage, singular-transform compatibility and native parity remain open.

GPU camera-space-position texture generation17893 PASS on WebGL1/2. The fixed
vertex path accepts TCI_CAMERASPACEPOSITION, ignores the supplied UV stream,
computes WORLD then VIEW position (not projection), and feeds it through the
texture matrix. A pixel test independently changes world/view and zeros projected
z, distinguishing camera position from object coordinates, clip coordinates and
default UVs. This follows Microsoft's
[generated-coordinate contract](https://learn.microsoft.com/en-us/windows/win32/direct3d9/automatically-generated-texture-coordinates).
Normal/reflection generation, POSITIONT generation, programmable-VS generation,
and the fixed-VS/programmed-PS generated linkage remain gated; native camera
generation is not yet implemented. No capabilities are expanded.

Fixed bump integration55779 PASS extends the GPU fixture to84 actual draws:
WebGL1/2, fixed/programmed VS and bump stages0/1/4 (environment stages1/2/5).
It also verifies matrix-only changes reuse shader programs while changing pixels,
and nonfinite matrix rejection preserves prior pixels. This covers high-stage
varying/sampler linkage, not just stage0 or the fixed vertex path. Native
cascade58088 passes56 bump cases across fixed/programmed VS and source
stages0/1/3/4, plus raw-CURRENT/alpha preservation and negative-state variants.
Fixed-origin TEXBEML carries a private packet flag for clamped RGB luminance
with preserved sampled alpha; ordinary guest TEXBEML tests retain RGBA scaling
with unclamped luminance before framebuffer conversion. Unmarked IR cannot
enable the private flag or high TEXBEM(L) samplers. VM70202 passes227 cases;
logical58688 and diff gates pass. Coefficients remain source-stage TSS state,
remapped by the adapter to the existing destination-keyed native binder.

GPU fixed bump22/23 regression20407 PASS:24 actual draws across WebGL1/2 and
bump stages0/1 verify signed format62 deltas, both off-diagonal matrix terms,
source-stage rather than destination-stage coefficient lookup, luminance,
environment alpha preservation and adding the environment result to retained
base color. ALPHAOP22 is rejected. Existing immutable `draw.bumpStates` and
signed-float texture uploads are reused; there is no new resource transport.
The coordinate/luminance equations follow Microsoft's
[bump formulas](https://learn.microsoft.com/en-us/windows/win32/direct3d9/bump-mapping-formulas)
and [three-stage example](https://learn.microsoft.com/en-us/windows/win32/direct3d9/using-bump-mapping).
Initial implementation is format62 only; projected/cube environment coordinates
remain gated. Extreme luminance clamp behavior and other format/combiner
interactions still require Windows-reference coverage. The native checkpoint
above implements the same bounded subset, with caps unchanged. Test manifest
passes1008 tests.

GPU PREMODULATE17 regression9924 PASS on WebGL1/2. Stage17 selects ARG1;
the immediately following stage premultiplies CURRENT arguments by its own
texture, if bound. Sampling is requested even without an explicit TEXTURE
argument. Twenty-four cases per version cover color/alpha/both, missing texture,
complement and alpha replication; additional draws verify one-stage expiration
and that writing TEMP does not mutate stored CURRENT. The implementation applies
independent preceding color/alpha enable masks before argument modifiers. This
is the current interpretation of Microsoft's
[PREMODULATE contract](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dtextureop);
cross-channel edge cases still need a Windows behavioral reference. Native
cascade22575 passes the24-case matrix plus expiration, TEMP, final-stage ARG1,
ignored ARG2 and triadic ARG0 tests. Raw CURRENT remains separate for implicit
alpha preservation and blend factors. The complete native cascade regression
passes with a maximum75 instructions in the128-instruction owned arena;
logical55347 and diff checks pass. No capability expansion.

GPU DOTPRODUCT3 operation24 now lowers to a signed RGB dot product with separate
color/alpha output masks. Mixed regression58654 PASS includes72 DOT3 draws per
WebGL version: constant and sampled inputs, complement/alpha replication,
RGB-only/alpha-only/both, unsaturated and clamped outputs, and TEMP routing.
Signed expansion uses `2*x-1`, following the interpretation of signed inputs
in Microsoft's [operation contract](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dtextureop)
and [signed-scale shader example](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-ps-registers-modifiers-signed-scale).
These are equation-based GPU checks, not a native Windows reference capture or
an assertion of legacy D3D6/7 numerical equivalence. Native cascade92609 PASS
adds96 scalar-oracle cases and matching full-frame programmable PS1.1 DP3
draws, plus two TEMP-routing cases. Native lowering retains both channel masks,
composes argument complement/alpha replication with signed scaling, and uses
the existing threaded SIMD DP3 operation. Logical26633 and fragment/diff gates
pass; no capability bits are expanded.

GPU texture-transform regression41365 PASS on forced WebGL1/2: COUNT2/3/4,
projected COUNT3/4 with division in the fragment stage, matrix uniforms without
shader-cache churn, and POSITIONT matrix bypass. Host snapshots retain copied
per-stage texture matrices; async-protocol regression passes. A new FLOAT2 case
first failed4917, then passed after supplying the third coordinate required by
Microsoft's [_31/_32 texture-scrolling example](https://learn.microsoft.com/en-us/windows/win32/direct3d9/special-effects).
This establishes that documented example, not exhaustive missing-component
padding conformance: FLOAT1 and independently varied fourth-row coefficients
still need a native Direct3D behavioral reference. Broader generated coordinates,
transformed fixed VS/programmed PS linkage, COUNT1 and
projected cube coordinates remain open. Mixed GPU4707 passes; diff-check clean.

Native transform cascade71572 PASS: COUNT2/3/4 and projected3/4 across all six
stages, six simultaneously distinct matrices, camera-space position generation
through world/view without UV input, and POSITIONT matrix bypass. A pixel
boundary distinguishes postinterpolation projection from pervertex division.
New `d3d_fixed_compile_cascade3` consumes128-byte rows preserving the56-byte
prefix, followed by input dimension/reserved0 and a copied4x4 matrix; both old
exports remain tested. Native VS lowering uses at most78 instructions in the
128-instruction arena. Projection uses reserved sampler+40, clears on every
legacy/mip rebind, and cannot change after raster starts. Zero/nonfinite Q or
nonfinite divided UV yields transparent black in affected lanes; sanitized
helper UVs feed LOD. Mixed invalid-lane/LOD and missing FLOAT2 fourth-component
padding still require a Windows reference (current w=1). Projected cube/bump
remains an explicit gate; mixed programmed-PS support is recorded below. VM34857 PASS227,
PSIZE18980 PASS and real COM12268 PASS; capabilities remain unchanged.

Native camera NORMAL/reflection cascade67387 PASS supersedes the native
generation gaps above: a bounded WAT f64 full4x4 world-view inverse feeds the
upper3x3 inverse-transpose normal transform, optional NORMALIZENORMALS, and
LOCALVIEWER-dependent reflection. Actual pixels distinguish non-affine4x4 from
3x3 inversion, nonuniform scaling, normalized/non-normalized normals and the
two local-viewer cube faces. Six simultaneous generated stages reuse native
normal/reflection temporaries while retaining distinct texture matrices; maximum
VS/PS IR is90/128 instructions. New cascade4 rows136 preserve the128-byte prefix
and append NORMAL input register/state flags;48/56/128 exports remain tested.
The original unused-UV-slot input restriction is superseded by native descriptor
ABI5 below. No host matrix/shader math was added. Singular/nonfinite inverse matrices reject before
target writes. Zero, underflowed or nonfinite squared vector length normalizes
to zero through existing native selection packets; these deterministic edge
policies are not Windows-reference conformance. PSIZE82165 and real COM55373
regressions PASS; capabilities remain unchanged.

Native input packing ABI5 (128-byte descriptor, unchanged output/cascade layouts)
retains position, diffuse, six independent UVs, PSIZE, NORMAL and SPECULAR at once.
Offset120 is total float4 input count3..11; offset116 maps the first three input
registers and offset124 maps the remaining eight with four-bit register indices.
WAT uses an i64 mapping, validates distinct registers, unused bits, count, stride
and input extent before reads. ABI1–4 keep their original field meanings; the
adapter selects ABI5 only for extra NORMAL/SPECULAR inputs. Cascade89924 PASS
includes eleven live inputs, individual six-UV pixel changes, and fixed camera
NORMAL with supplied SPECULAR fog. Raster39791 PASS351 covers high mapping bits,
malformed descriptors and wrapping/out-of-memory extents; PSIZE55119 and real
COM87572 PASS. No guest caps expansion or Windows-reference conformance claim.

Native mixed projection86960 PASS extends the existing per-fragment sampler
projection to fixed VS with real PS1.1/1.2/1.3 TEX at stages0–3, for COUNT3/4.
Pixels distinguish postinterpolation division; invalid Q/divided coordinates
become black while negative finite divisors remain valid. TEXKILL before and
after TEX still consumes original interpolated XYZ. Projected TEXCOORD and
dependent destinations remain explicit gates, but unrelated unprojected
TEXCOORD/TEXREG2AR stages work; DEF constants are not misclassified as texture
destinations. Rebinding an unprojected draw clears metadata.
This slice only changes adapter validation/binding; it reuses the existing WAT
TEX projection and does not change guest opcode validation, VM/raster ABI or
capabilities. PSIZE33524 and actual COM24829 regressions PASS. PS1.4 projection,
projected cube/dependent sampling and mixed-invalid-lane LOD reference parity
remain open.

GPU fixed cube sampling87176 PASS: fixed pixel compilation now selects cube
samplers and three-component varyings from the bound resource, preserving the
existing generic cube upload path. Forty-eight actual pixel cases cover all six
faces at stages0/1, fixed/programmed vertex linkage and forced WebGL1/2.
This implements explicit direction coordinates, not automatic reflection/normal
generation or texture transforms. Native follow-up28633 passes all six faces
at stages0/1/5 with fixed/programmed vertex linkage (36 actual SIMD draws).
That exposed a VM coordinate-snapshot bug: PC0 retained only t0..3 while fixed
TEX4/5 cube sampling needs original XYZ too. The private snapshot now retains
six banks within its allocated register area; VM67958 passes227 cases.
The texture contract requires a three-dimensional direction as described in
[cubic environment mapping](https://learn.microsoft.com/en-us/windows/win32/direct3d9/cubic-environment-mapping).
Mixed combiner regression13395 passes. Full WAT GPU63897 timed out during page
navigation before assertions; separate rerun60758 subsequently passes. Host
load average was66 during the retry, so no performance conclusion is drawn.
Manifest passes with1006 discovered tests.

GPU triadic combiner26996 PASS: MULTIPLYADD25 computes ARG0+ARG1*ARG2;
LERP26 computes ARG0*ARG1+(1-ARG0)*ARG2. Argument ordering was cross-checked
against [Wine's fixed-function GLSL implementation](https://github.com/wine-mirror/wine/blob/master/dlls/wined3d/glsl_shader.c)
because the generic Arg1/Arg2/Arg3 prose can be confused with TSS argument names.
Host snapshots now include COLORARG0/ALPHAARG0 (native defaults already CURRENT).
Async-protocol tests verify both survive guest mutation. Eight real pixel cases
per WebGL version distinguish texture-only-in-ARG0 sampling, factor, complement,
alpha replication and independent color/alpha third arguments. Native software
25/26 now pass native follow-up28633 with ARG0-only sampling, complement,
alpha replication, distinct RGB/alpha operands and TEMP/CURRENT ordering.
The new `d3d_fixed_compile_cascade2` appends ARG0 fields to56-byte rows;
the old48-byte export remains valid with implicit CURRENT ARG0. Tests compare
old/new default lowering byte-for-byte and verify allocation retirement.
No capability expansion accompanies this change.

Fresh real-game probe33057 is live with diagnostic native1123354/compat1123822
artifacts in `/private/tmp/bw-cascade-native.Ca0YQN`, layoutdeb1a4136a973485.
It includes the POSITIONT correction, PSIZE and native six-stage cascade2..11.
Artifacts are under `bw-software-probe-6cn5Lr` in the usual temp root; explicit
guard14400seconds, capture interval60seconds, live control enabled. Ping confirms
the process and initial draw completions withzero failures. This is startup,
not menu/gameplay acceptance. Full build15187 still fails on unrelated stale
ToyVM browser bundles; diagnostic paired compilation49656 passes separately.
GPU pipeline29799 and private PS1.4 differential73241 also pass before this run.

GPU color/alpha combiner34132 PASS adds color operations18..21:
MODULATEALPHA_ADDCOLOR, MODULATECOLOR_ADDALPHA and their inverse-alpha/color
variants. Forced WebGL1/2 pixels match separately evaluated equations with
one-byte UNORM tolerance, retain the separately selected alpha, and reject
these color-only operations when assigned to ALPHAOP without changing pixels.
Native follow-up91254 now passes ops2..16 and color-only18..21, including
independent blend factors, argument modifiers and invalid-alpha rejection.
No capability expansion accompanies this checkpoint.

GPU combiner follow-up adds ops12..16: diffuse, texture, factor and CURRENT
alpha interpolation plus premultiplied texture-alpha blending. Forced WebGL1/2
pixel tests distinguish all factors, including alpha retained from the previous
stage; factor selection is independent of source argument modifiers. The matrix
follows [D3DTEXTUREOP](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dtextureop).

RESULTARG transport bug fixed: host snapshots now retain TSS28 instead of
silently dropping it. Native setters accept only CURRENT1/TEMP5 and preserve
state on invalid input (stateblocks36042 PASS); async-protocol mutation tests
verify retained result routing. Existing native defaults were already CURRENT.
GPU TEMP is initialized to zero, can receive a stage result without replacing
CURRENT, and can feed later stages. The last active stage must write CURRENT.
Forced WebGL1/2 mixed tests pass these real pixels, with one UNORM rounding step
allowed for arithmetic at half-byte boundaries; full WAT GPU45292 passes.
This follows the [RESULTARG contract](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dtexturestagestatetype).
Native follow-up91254 also passes zero-initialized TEMP, pre-stage CURRENT/TEMP
reads, deferred TEMP publication and last-active-stage CURRENT enforcement.
No TEMP or additional operation caps advertised.

GPU fixed-function cascade24482 PASS on forced WebGL1 and WebGL2: ordered
CURRENT through up to six stages, independent stage constants, texture samplers
and coordinate selection, default missing UVs, fixed/programmed vertex linkage,
COLOROP_DISABLE and NULL-texture cascade termination. Six active stages produce
the expected pixel; an active seventh stage rejects before changing pixels.
The existing operation subset2..11 is retained, not a claim of all texture ops,
TEMP/result routing, transforms, lighting or eight-stage completeness. Native
software cascade63695 now passes real SIMD pixels for ops2..11 through six
ordered stages, distinct c2..7 stage constants, independent UV5/sampler1,
CURRENT alpha replication/complement and disable/null-texture termination.
The new native `d3d_fixed_compile_cascade` consumes the unchanged DFX descriptor
plus bounded48-byte stage records; it owns both native programs through draw
completion. Tests check worst-case instruction expansion and allocation
retirement after success/rejection. PSIZE55360, legacy fixed31413 (46 cases)
and full software COM55586 fixed/mixed/programmed/Present regressions pass.
Follow-up91254 adds the TEMP/operation parity above and executes all six sampled
stages in a69-instruction stress case. The owned IR arena now holds128
instructions. The VM allows TEX/TEXBEM(L) sampler4/5 only for fixed-origin IR flag4;
clearing that marker rejects the same IR, preserving guest profile limits.
Ops27+, broader bump formats, broader generated coordinates and eight-stage completeness remain
explicit gaps; caps are unchanged.
Full WAT GPU pipeline99165 and native NULL-shader selection25535 pass after
the GPU change. Earlier two-stage focused14000 and baseline1843 also pass.

Real game probe93079 finished gracefully at7200seconds, reaching introframe1787
past its exit threshold1786 withzero render failures. Its inspected final image
shows an island backdrop and dialog-like panel with missing/garbled text, not
verified gameplay. It used the older frozen stencil build, predating POSITIONT
precision and later implementation; current-source acceptance needs a fresh
matched artifact. See the Black & White RE note for exact evidence/artifacts.

PS1.4 boundary differential55097 PASS expands the shared-IR fixture to13 full
frames on native SIMD, WebGL1 and WebGL2. Added BEM source negation combined
with destination divide-by-two, and TEXDEPTH zero-denominator, negative-ratio
and above-one-ratio cases against the same D16 depth test. These follow the
[BEM modifier contract](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/bem---ps)
and [TEXDEPTH zero-denominator rule](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/texdepth---ps).
The source audit confirms TEXLD's previous-phase XYZ initialization and
two-use projective-Z rules are represented in the private validator; its
conservative combined coissue read-port policy still needs reference evidence.
No public profile gate or capability advertisement changed.

Resolved 2026-10-10 (D3D9-CREATE-DRAW-SHADER-AGREEMENT): Microsoft's
[ps_1_x Registers](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-ps-registers-ps-1-x)
read port limit counts registers "in a single instruction" (1.4: c#2, r#3).
`$d3d_ir_scan14` dropped its combined pair limit, which refused B&W2's
grass.sdv pair reading four temps. The VM's ps_1_4 pair rule now takes any
non-empty r/g/b subset with `.a`, per the
[write-mask reference](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-ps-registers-modifiers-write-mask)
(1.4 masks are arbitrary). CreatePixel/VertexShader also run
`$d3d_shader_vm_compile` when the software executor reports 0x800, and return
D3DERR_INVALIDCALL on refusal, so a draw can no longer be the first to refuse.
`test-d3d-shader-ir.js` VM-compiles every IR-accepted shape it builds.

Three-way PS1.4 differential78418 PASS extends the GPU-only fixture below:
the exact same native IR is compiled to SIMD threaded programs and GLSL.
All nine cases execute the real native rasterizer in one-quad resumable slices
and both forced WebGL backends. All64 pixels per case match an explicit expected
image and each other after BGRA/RGBA and row-origin normalization. Native
TEXDEPTH uses a D16 attachment with the same initial depth as the GPU path.
Programs, raster contexts and test allocations are retired after execution.
The earlier single-sample native differential13853 also passed. These are
constant-varying integration cases, not complete derivative/interpolation,
profile-validation, public COM or game conformance.

Private PS1.4 GPU integration55296 PASS: actual bytecode goes through the
private native validator and shared IR into forced WebGL1 and WebGL2. Nine
pixel cases cover sampler5, phase-dependent lookup, BEM, current-register
TEXKILL, TEXDEPTH, component-wise CND, RGB preservation with explicit alpha
restoration across PHASE, and projected texture coordinates using both W and Z.
Every case checks actual framebuffer pixels and GL errors. This extends the
earlier five-case38382 result; public PS1.4 compilation remains explicitly
rejected by the test. It is not full profile or public COM acceptance.
Test manifest passes with1003 discovered tests; no full-build claim follows.

GPU mixed-stage follow-up48319 PASS in forced WebGL1 and2: NULL VS with
programmed PS and programmed VS with NULL PS link through canonical color and
texture varyings, preserve active-stage behavior, and ignore inactive fixed
pixel/vertex settings. Invalid bound shaders reject without fixed fallback.
Programmed pixel alpha testing now uses a post-shader discard wrapper and a
reference uniform; changing the reference preserves the cached program. Full
WAT GPU pipeline26733 passes after the change. Fixed texture-coordinate
metadata snapshots now include six rows with delayed-mutation coverage.
This remains the existing bounded fixed-function subset: lighting, fog,
texture transforms and post-pixel
specular with a programmed PS are not claimed as implemented.

The PS1.4 shader agents stopped with usage-limit errors after their reported
incremental checkpoints. Their WIP remains in the shared tree; fragment
balance passes, but unfinished opcode/profile work is not accepted as complete.
Root revalidation: IR22630 PASS and SIMD VM18907 PASS227 cases. New private
stage-linkage32416 PASS takes actual PS1.4 TEXLD bytecode through the private
native validator, threaded SIMD compiler and ABI3 rasterizer; interpolated t5
selects the correct texel from sampler5. It explicitly checks that the public
PS1.4 compiler remains gated. This joins the previously separate components;
it is not a full opcode/profile conformance or public COM acceptance result.

PS1.4 prerequisite: Bridge FVF parsing accepts six coordinate sets, with an
async-protocol regression proving UV4/5 bytes and declarations survive guest
mutation before worker consumption. This is coordinate transport only, not
six-sampler rendering or public PS1.4 acceptance. The native four-slot texture
array ends at the buffer-vtable field1716; the four sampler rows end at the
state-block-vtable field2064. The migration now appends stage4/5 texture
bindings at21792 and sampler rows at21800 (device size21928), plus state-block
texture masks/pointers and sampler masks/values through size22240. Native
get/set, defaults, reset, state-block and release paths use the split layout;
extending the old array arithmetic would alias live device fields.
Compiled stateblocks24044 PASS repeated binding/capture/apply/reference
retirement for both new stages. Reset58221 PASS direct/worker failure retention,
successful unbinding and restored sampler defaults. Async-protocol tests prove
six-stage pixel/sampler/bump snapshots survive guest mutation. Real WAT-to-
WebGL2 pipeline12087 PASS after migration. These resource/transport results do
not establish PS1.4 execution; its public shader gate remains closed.
The stronger Reset/release regression30254 also PASS direct/worker: managed
textures bound at stages4/5 survive external Release, then final device Release
and worker retirement return both texture objects and pixel allocations to the
parent native free list. This verifies allocator reuse eligibility rather than
inferring reclamation from counters in freed objects.

Agent outline32985 reports28 native/GPU comparisons passing: original edge
coverage, clipping without new caps, LASTPIXEL, winding, perspective colors,
blended endpoint overdraw, fixed POSITIONT and POINT. The WebGL2 executor uses
transform feedback and instanced GPU rasterization, without production readback
or host shader math. Exact INDEX16 vertex65535 is widened before WebGL2 draw to
avoid its mandatory primitive-restart sentinel. Follow-up53521 passed33 native/GPU
cases with shader-written point size, generated sprite coordinates and fixed
camera-distance attenuation (POSITIONT bypasses attenuation). Antialiased
outlines, programmable attenuation and the WebGL1 equivalent remain explicit
gaps; MaxPointSize remains1.

PSIZE follow-up41787 passes actual COM FVF XYZ/XYZRHW+PSIZE, independent
declaration register mapping and programmable v4→oPts pixel tests. DSP descriptor
ABI4 retains128 bytes and appends a ninth PSIZE float4 input after up to six UVs;
its register occupies +124 bits20..23. DFX ABI3 retains320 bytes, with flag128
and register+304 selecting per-vertex size before native attenuation. Old ABIs
remain supported. Tests reject duplicate registers, reserved map bits, truncated
input stride and non-FLOAT1 PSIZE; temporary native allocations retire after
valid and invalid draws. Actual GPU/native outline96044 passes36 cases including
fixed XYZ/POSITIONT PSIZE and per-vertex attenuation (POINTSIZE=0 cannot replace
the vertex value). Fixed-native82748 passes46 cases. The general software adapter
suite still stops at its pre-existing raw PS1.4 fixture while that public version
gate is closed; this is not a full-suite pass or a PS1.4 gate change.

WebGL2 NPOT texture follow-up47241 PASS: real3x1 texture repeat/mirror/clamp
sampling and a distinct1x1 lower mip through the production D3D texture upload
path. WebGL1 rejects unsupported NPOT repeat/mip combinations and still samples
clamped NPOT textures. This removes WebGL1-only restrictions from the WebGL2
executor without changing guest capability advertisement. The
[WebGL2 NPOT contract](https://registry.khronos.org/webgl/specs/2.0/#NON_POWER_OF_TWO_TEXTURE_ACCESS)
permits these wrapping and mipmapping operations.

WebGL2 baseline (2026-09-10): D3D9 selects WebGL2 first with WebGL1 fallback;
the generic WGL GPU constructor still defaults to WebGL1. Explicit version
selection, generated GLSL300 conversion, core derivatives/fragment depth, and
real transform-feedback vertex output pass `test-d3d9-webgl-versions.js`95558.
Transform feedback is an optional pre-link program contract, not yet a completed
wireframe renderer. Signed bump texture and mip-atlas uploads use RGBA32F on
WebGL2; the full shader corpus exposed the old unsized float upload error before
this correction. Forced WebGL1 shader corpus3743 passes. WebGL2 corpus54131
then exposed a reserved GLSL identifier in the mip helper, since corrected;
the rerun and broader integration gates remain pending. Shader corpus version
selection uses `D3D9_WEBGL_VERSION=1|2`, with version-specific checks that core
WebGL2 features do not depend on legacy extension objects. No full-profile or
cross-browser parity claim follows from this baseline.

Follow-up: shader_ir reports full forced-WebGL2 shader corpus26800 PASS after
the mip identifier fix, including oPts 2/4 point sizes producing4/16 pixels,
PS1.3 depth replacement, and manual mip sampling. Native oPts VM75843 passes219
cases. The generic shader/program compiler now retires successful earlier
allocations when later allocation, compilation, transform-feedback setup,
linking or location lookup fails; fault-injection `test-gpu-backend.js` passes
and real WebGL1/2/transform-feedback regression48782 passes after the change.

WebGL2 stencil27274 passes all eight operations, depth-fail/pass outcomes,
masks, winding, oversized attachments, rectangular Clear and release. Test-tier
and timeout gates8447 pass with999 discovered tests. Native-to-WebGL pipeline
31894 stopped at WAT parsing (extra closing parenthesis) during concurrent native
point-size edits, before GPU execution; it requires a stable-source rerun, not
a claimed pipeline pass.
The native point-size source subsequently became balanced and passed the
agent's324-case raster suite; integration62142 and full build75546 are running
against the updated source. Earlier parse failures are terminal historical
attempts, not still-running tests. Integration62142 subsequently PASS: real WAT
D3D9 shader/texture UP and INDEX16/32 buffer draws, native bump snapshot and
Present produce canonical BGRA pixels on the WebGL2 default. Full build75546
passes all gates through browser-cache consistency, then fails at the existing
foreign-owned stale ToyVM browser bundles; it is not a full-build pass.

Neither backend nor the full adapter is complete. Entries below are chronological
slice evidence, not a claim that every historical result still passes the current
worktree. The expanded native occlusion Reset regression exposed a fixture bug:
it reused presentation parameters modified by Reset, so its second device was
640x480 instead of8x8. That changed fixed-function vertex rounding and produced40
samples instead of36. Restoring the input parameters and asserting Reset's
writeback fixes the fixture; direct/worker62298 passes with the36 oracle
unchanged. The expanded test covers successful/failed Reset query-output guards
and fresh brackets after recovery. Native raster90920 passes186 cases and
EVENT12765 passes separately; this still is not full Reset conformance.

The1800-second Black & White software probe20567 ended normally at introframe560
of636, with3514 completed draws,563 completed presents and zero recorded render
failures. Its final image was inspected: Lionhead logo, particles and reflection,
not gameplay. See [application evidence](re-notes/black-white-2.md) for the frozen
artifact and capture directory. This old native snapshot does not validate the
subsequent shader/stencil changes. Next game acceptance requires a fresh matching
native/host snapshot and a longer observation window.

Fresh native compile80284 succeeds at1112758/1113226 bytes, region layout
`deb1a4136a973485`. This is a compiler result, not a full build-gate pass. A new
7200-second probe93079 is running with that artifact, periodic frames and optional
stdin forwarding to the existing CLI controls. A relayed ping succeeds with its
caller id intact. Its artifacts are in
`/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/bw-software-probe-pOr4aX`;
no gameplay result is available yet.

The missing shared depth-serial size declaration and two raw logical-AND
operands are fixed. Build76422 passes through memory-map, region, logical-AND,
silent-handler, import and browser-cache gates, then stops at stale generated
ToyVM browser bundles owned by another workstream. Those bundles have not been
rewritten or the reproducibility gate waived. Full build acceptance is pending.

Integration follow-up: large-draw22384 passes the32-frame stress with the stencil
snapshot. Occlusion92518 passes direct/worker after explicitly marking its tiny
test device windowed, as required by tightened fullscreen-mode validation.
The probe-control regression passes mocked protocol tests for unique internal
request ids, caller-id replies, malformed input and orderly quit racing an
outstanding initial handshake. Test-manifest92518 accounts for993 tests.

Presentation integration53139/40184: synchronous software COM, async-protocol
and full WAT-to-WebGL pixel fixtures explicitly request IMMEDIATE and pass with
the new paced DEFAULT/ONE implementation. No depth-default workaround was needed
for the initially observed stale pixels; the old fixture had read them before
the newly asynchronous Present completed. Dedicated cadence tests cover pacing
separately rather than disabling it in production.

Precision regression8239 isolated an actual screen-coordinate preservation gap:
the same POSITIONT triangle counted36 samples at8x8 but42 at320x240, without
Reset. Fixed-function clip-space roundtripping changed pixel-edge ownership.
The software fix now emits native screen-space position from the fixed VS and
uses descriptor flag4 to preserve XYZ/RHW through raster setup. Other fixed VS
outputs still use shared IR/SIMD; no JS geometry or per-pixel math was added.
Ordinary pre-transformed inputs bypass homogeneous clipping; ProcessVertices
origin-specific clipping remains a required frontend distinction.

Expanded86495 passes exact36 samples and edge pixels across five target sizes,
viewport offsets, preserved depth with non-default MinZ/MaxZ, RHW0.25/2,
partially/fully offscreen triangles and production-worker query counts.
Offscreen coverage exposed unsigned bounding-conversion traps; scan bounds now
intersect the viewport before conversion without clamping vertices. Empty wire
edges advance to the next edge instead of dropping the entire triangle.
Backend/fixed40-case51563, COM/query83934, native raster285-case9643 and logical
operand61242 checks pass separately. This is software evidence, not a claim of
GPU numerical parity or full pre-transformed vertex conformance.

Frontend regression checkpoint: CLI54605, browser38007 (cooperative main and
guest-main Worker), and actual x86/production-worker98597 pass with the updated
source. The protocol-only continuation fixture initially expected Clear to run
the old native whole-target fill on backend completion. That contradicts the
current backend-owned target/Present publication contract. Its corrected7855
test preserves canonical pixels through successful and failed Clear completion
and passes all draw/Present/Clear/query/Release retry and stack checks. Real
backend Clear pixels remain covered separately by the COM and worker suites.

## Historical implementation checkpoints

Native COM occlusion follow-up90699 PASS: software CreateQuery(OCCLUSION), Issue
and GetData now use the ordered broker path. BEGIN/END return without a render
park; unfinished GetData returns S_FALSE without modifying the output. Flags/size
and building-state validation, DWORD result36 from a real triangle, status-only
polling, pending release with immediate allocation reuse, and final-child device
teardown pass in direct and production-worker modes. EVENT47143 also passes.
Host completion records never write guest memory asynchronously; current GetData
alone copies the ready result. Software-only support is probed explicitly; pure
WebGL still rejects counted occlusion. Reset invalidation and broader native
state-transition/overflow references remain required conformance coverage, as do
stencil/multisample integration once those target modes are implemented. Earlier
occlusion entries below describe intermediate checkpoints, not current API absence.

WebGL depth attachments (2026-09-10): `test-d3d9-depth-web.js`14089 passes
real GPU D16/D24X8/D24S8 depth-only A→B→A preservation, oversized depth surfaces,
null binding, partial Clear, Present/readback, release and resize Reset. Persistent
renderbuffers are keyed by native serial; matching-size RGBA color backings move
logical target color via GPU copies on switches. Requested16/24-bit depth storage
is verified; multisample operations remain unsupported. The256MiB target
budget charges color and depth, including old+new allocations during atomic Reset;
failed allocation preserves old pixels and dimensions. This introduces attachment
switch copies and a presentation blit, not CPU per-pixel attachment transfers.
RGBA backing now preserves shader alpha that the old opaque default canvas hid.

GPU stencil follow-up39443 PASS (`test-d3d9-stencil-web.js`): D24S8 storage,
all eight comparisons and operations, fail/depth-fail/pass ordering, read/write
masks, rectangular Clear, two-sided winding, attachment identity/release and
post-Present state restoration. CW faces use standard state and CCW faces use
the alternate operations, with shared reference/masks, matching
[D3D9 two-sided stencil](https://learn.microsoft.com/en-us/windows/win32/direct3d9/two-sided-stencil).
D16/D24X8 stencil requests reject. This is GPU adapter evidence; native setters,
Bridge snapshot wiring and software execution are being implemented separately,
not implied complete by this pixel test.

Occlusion prerequisite (2026-09-10): native raster contexts now retain a64-bit
passed-sample count at private offset240, with header256 and allocation bounds
updated together. `d3d_software_samples` publishes only completed draws; partial,
cancelled or invalid contexts return-1. Counting occurs after coverage/depth,
TEXKILL and alpha rejection, independently of color/depth write masks. Native
pipeline13093 passes186cases including overdraw, depth-disabled/rejected lanes,
zero write masks, completion polling, partial quads, alpha/discard and cancellation.
This is groundwork for [D3D9 occlusion queries](https://learn.microsoft.com/en-us/windows/win32/direct3d9/queries),
not a claim that the guest query API is implemented: queued BEGIN/END/GetData,
multi-batch aggregation, query lifecycle, stencil and multisampling remain open.

Aggregation follow-up54329 PASS: the software adapter now accumulates completed
native counts across all retained contexts of a split draw using BigInt, then
publishes once before release. The2950-triangle fixture verifies106200 samples
for synchronous and asynchronous execution. Preflight/budget failures and
mid-batch cancellation publish no partial count. Ordered query commands and
guest BEGIN/END/GetData wiring are still required; no occlusion capability is
advertised by this adapter-counter change.

Neutral software query transport92505 PASS (real production worker): ordered
QUERY_BEGIN/QUERY_END bracket native samples, overlapping identities retain
independent baselines, BEGIN restarts, and Clear contributes none. END publishes
data-only low/high32-bit words. Query release preserves the device; missing
BEGIN returns an error. Active brackets are bounded to4096 and charged32bytes
each; restart does not double-charge, budget failure is atomic, and device
destruction releases unfinished brackets. Worker shutdown confirms zero owned
bytes. Guest IDirect3DQuery9 occlusion creation/Issue/GetData and WebGL mapping
are still absent, so guest occlusion capability remains unadvertised.

Native lifetime correction (2026-09-10): sparse allocations exposed a missing
inverse translation in `w2g`: guest1341128708 mapped to WASM134217732 but back to
guest134144004, so native shader/raster frees silently failed heap validation.
`03-registers.wat` now resolves sparse backing through the locked live map while
preserving direct/private and DIB behavior. `test-d3d-render-lifetime.js` verifies
interior-pointer round trips and actual sparse allocation reuse after VM free
(51141 PASS). The 32-frame `test-d3d9-large-draw.js --stress-mips` run now passes
(93161); sparse cursor and free bytes stabilize after warm-up rather than failing
around frame28. Disabling coalescing (41282) still completes32frames but grows
free-list fragmentation from494 to6661 blocks and free bytes from14MB to98MB;
with coalescing both stabilize after warm-up. Lifetime20572 additionally verifies
unsorted adjacent merges, idempotence, small-fit preservation, merged allocation
reuse, live-byte preservation and cycle rejection. Map release now takes the same
recursive lock as inverse lookup, preventing concurrent record compaction during
the scan. A fresh long real-game
run is required before claiming the intro allocation failure is resolved in-game.

Follow-up: post-fix180s game probe reached introframe43 with414 completed draws
and zero failures (see Black & White RE notes). This proves continued rendering
past the previous frame5 failure, not gameplay. The large-draw test now runs its
32-frame mip stress by default and asserts stable allocator state after warm-up;
81119 passes with the expanded62848-byte shader VM context as well. Build81724
passes early structural/test-manifest gates but stops at the changed silent-handler
inventory; full build acceptance remains open pending the owning agent's audit.

2026-09-10. Tracks implementation of [the design](direct3d-dual-backend-design.md).
The full goal remains open. A green unit test does not establish a complete
shader profile, backend, adapter, or game.

```text
Shared IR reader + GLSL entry       IMPLEMENTED / focused tests pass
WAT validator + normalized IR       INITIAL SUBSET TESTED
WAT SIMD threaded shader executor  ARITHMETIC + INITIAL SAMPLING TESTED
Shared queue direct/worker          TRANSPORT + WEBGL BRIDGE TESTED
Software D3D9 COM draw in Node      PROGRAMMABLE + UNLIT FIXED SUBSETS TESTED
Production WAT render-worker       PIXELS + GRACEFUL HEAP HANDOFF TESTED
Guest bridge -> async worker       REAL X86/WORKER PIXELS TESTED; LAUNCH GATES OPEN
Both-backend full adapter parity    NOT COMPLETE
```

## Delivery gates

Shader authority hardening: real CreateShader already validates in WAT. The
production Bridge now rejects missing native validator exports instead of
falling back to JavaScript token parsing. GPU `compileNativeIR` projects the
serialized native IR, ignoring redundant JS instruction/profile fields; public
PS1.4 and internal fixed-origin flags remain gated. Its checks validate transport
structure, not the semantic legitimacy of arbitrary bytes: WAT `Compiler` is the
trusted producer. Standalone `parse`/`compile` and legacy validation opcode remain
diagnostic interfaces, outside the production CreateShader/draw route.
Native corpus24963, real GPU pipeline60578, IR-view/async missing-validator
no-DRAW tests, dependency graph and cache checks PASS.

Creation now retains its privately validated IR as a contiguous tail after the
unchanged24-byte shader header and GetFunction tokens. Finalization copies the
IR out of the validator's instance-owned allocation and frees both temporary
allocations; ordinary shader resource release owns the entire retained block.
The bounded JS retained-view cache checks content on pointer reuse and never
calls the WAT compiler. Shader-object16920 verifies GetFunction, binding/external
references, zero temporary IR live bytes, whole-block retirement and detached
snapshot survival. Software COM94380 passes with the exported compiler replaced
by a throwing stub, proving draws consume the retained tail. GPU24748, real x86
worker79619 and stateblocks45209 PASS. Isolated final-allocation fault injection
92021 also PASS: three failures return OUT0/E_OUTOFMEMORY without changing device
references, free both temporaries with zero IR live bytes, then permit successful
creation/release. The test transforms only that allocation site; no production
fault hook is added. Full canonical/compat build15499 PASS, and native D3DX
software font85829 again renders863 white pixels after the concurrent main merges.

| Design phase | Current evidence | Remaining gate |
|---|---|---|
| 0 inventory/queue | Direct + real Node worker replay, leases/generations/fences; delayed write/readback regressions; production WAT worker pixel parity and post-exit heap reuse; WebGL bridge uses the queue | Async guest bridge convergence, complete per-feature matrix, forced-death native ownership recovery and broad production lifetime tests |
| 1 WAT IR | Native compiler GLSL parity, malformed streams/lifetime/budgets; strict initial VS1.1/PS1.1 stage-op, mask/modifier, register-port including combined coissue ports, per-component temporary initialization and slot rules tested; actual browser WAT-IR pixels pass; production Bridge consumes retained creation IR | Complete profile/linkage matrix, broad native references |
| 2 SIMD VM | 115 cases reported passing: bytecode->IR->packets, arithmetic/matrices, relative constants, SoA masks, PS1.1 sampling/discard, TEXBEM/BEML/REG2GB, bounded TEXM3x2 pairs, SIMD reciprocal/RSQ/EXP/LOG/LIT/FRC, coissue and resume/cancel | Mandatory texture operations, full profile legality/flow, native numerical references and optimized filtering |
| 3 software draw | 154 native raster cases pass including six-plane clipping, four texture varyings, bump pixels, blending and alpha test; COM strip/fan, locked resources, unlit NULL-shader XYZ/POSITIONT and Present reach canonical BGRA; actual x86 async Bridge/production-worker pixels and retirement pass; shipped CLI and both browser main-thread modes pass focused render-worker tests | Real-game validation, complete fixed-function and broader pipeline/resource ownership |
| 4 Black & White | WebGL intro observed earlier; software Lionhead particles/reflection now visually verified with completed draw/present counters and actual2950-triangle,11-level texture submissions | Menu-to-gameplay on both backends, replay parity, real input and changing scene |
| 5 pipeline/resources | Partial legacy/software and D3D9/WebGL implementations | Full advertised fixed-function, resource, API and raster contracts |
| 6 SM1–3/WebGL2 | Current partial VS/PS1.1 GLSL | Full legal profile matrix, WebGL2 lowering, tested emulation and truthful caps |
| 7 legacy/D3D8 | Separate legacy frontend/software pipeline | D3D8 frontend, version-specific semantics, both-backend corpus parity |
| 8 release/performance | No dual-backend acceptance yet | Memory/queue budgets, cancellation/loss/reset, worker modes, Safari/iOS and measured performance |

## Required conformance families (not yet complete)

Native blend slice: `d3d_software_bind_blend` copies a versioned 36-byte descriptor
into previously unused context storage, preserving descriptor ABI1/2 and allocation
bounds. WAT SIMD implements factors1–15 (legacy source aliases normalized),
ADD/SUBTRACT/REVSUBTRACT/MIN/MAX and separate alpha; dual-source D3D9Ex factors
remain rejected. Tests use independent scalar expectations, source-byte reuse,
invalid-state preservation, post-start binding rejection, depth rejection,
write masks, untouched pixels and pitch guards. The full 119-case raster suite
and real x86 production-worker test pass. This is a tested native output stage,
not yet proof of complete COM blend-state plumbing or historical GPU rounding.

Native device creation now initializes output states168/171/193/206–209 with
documented D3D9 defaults. The adapter regression verifies GetRenderState values,
stdcall/output boundaries, explicit zero color-write masks and selective
record/apply restoration. Its wrappers resolve API aliases from `api_table.json`
instead of referring to removed duplicate handlers. Full CreateStateBlock
remains unsupported; the regression does not claim that path. Blend adapter and
real COM default-only/explicit blend pixels have also passed the agent's tests;
fresh real-game acceptance is still required.

Alpha comparison default25 is also initialized to D3DCMP_ALWAYS (8); alpha
enable15/reference24 remain zero. Native getter tests pass for these values.
After per-component validator tightening, the root reran software COM, actual
x86 production-worker, and full WAT-to-WebGL pipeline tests successfully. These
are cross-layer regression checks; native alpha-test execution/integration has
since passed the focused checks below.

Alpha integration now passes:154 native raster cases, the software adapter's
fixed/programmed comparisons, queued mutation/cancellation tests, and real COM
default/boundary/reference-mask pixels. The Bridge snapshots alpha state for
both shader paths; software no longer rejects fixed alpha testing. Native
comparison uses clamped shader alpha against the normalized low8 reference;
historical hardware quantization and interpolation boundary parity remain
unverified. Fresh Black & White software execution has no renderer error lines
within its45-second wall guard, but its inspected frame is nearly white with a
faint spot, not gameplay. See the application notes for exact artifacts.

- API: interface identity, refcounts, creation/errors/caps, defaults/getters,
  state blocks, resource pools, reset/device loss, swap chains and queries.
- Vertices: complete declarations/FVF, streams/frequency/instancing, indexed/UP,
  transformations, skinning, materials/lighting and clipping.
- Raster: all topologies, edge/center rules, flat/Gouraud/perspective, culling,
  fill/points/lines, scissor/fog/bias, alpha/depth/stencil ordering and writes.
- Sampling: native/palettized/compressed/float/depth formats; cube/volume/mips;
  wrap/mirror/clamp/border, filtering/LOD/gradients/aniso/sRGB where advertised.
- Outputs: stage combiners, dependent textures, MRT, blending/write masks,
  format packing, multisampling and resolves.
- Ownership: subresource aliases/locks, DISCARD/NOOVERWRITE, copies/updates,
  readbacks, CPU/GPU transitions, in-flight retention and GDI/DDraw access.
- Shaders: VS1.1, PS1.1–1.4, VS/PS2.0/2_x/3.0; per-op legality, constants,
  relative access, control flow, derivatives, coissue, precision and limits.
- Transport: one stream/consumer per device, producer publication, fences,
  bounded backpressure, direct/worker parity, cancellation/stale generations.
- Validation: independent numeric fixtures, native references, draw replay,
  browser pixels, legacy corpus and genuine gameplay on both backends.

Post-merge root evidence (2026-09-10): canonical build passed at
1092653/1093121 bytes, layout `f73bfdc3f7f38137`; JS bridge integration
passed `test-d3d9-software-bridge.js` (real COM, actual native pixels, EVENT and
destruction, now also native buffer/texture locks and draws) and
`test-d3d9-pipeline-web.js` (existing WebGL pixel corpus).
`test-d3d-native-shader-create.js`, `test-d3d9-event-query.js` and
`test-d3d-browser-dependencies.js` also pass. New tests are discovered through
the current test-tier conventions. This is evidence for the named slices, not
the full adapter or gameplay. Ongoing native edits require another final build.

The software bridge returns completed pixels to the existing WAT `dx_present`
path; it does not require a fake DOM or create a second presentation surface.
The WebGL executor currently uses genuine `finish()` per command. Async batching
is future work, not a claim that issued GL commands are already complete.

Worker evidence (also rerun by root): `test-d3d9-software-worker.js` passes actual production
WAT execution in the existing render worker, ordered async pixels/readback,
parent memory/CPU survival, immutable frames, confirmed-exit-before-adoption and
actual allocator reuse. Root `test-d3d-render-lifetime.js` passes low/sparse heap
tail retirement, freed-block reuse, malformed/cyclic/intersecting-list rejection
and live parent data preservation. Device mapped-free failure remains retryable
without clearing its allocation ledger. Forced exit without a valid handoff
reports `ORPHANED`; it does not reclaim native allocations. Unused capacity in
older abandoned heap arenas also remains broader allocator work.

These worker tests do not yet prove asynchronous guest frontend integration.
The bridge now has a bounded asynchronous request registry, explicit readiness
and terminal polling, immutable Present snapshots, and Release ordering against
prior consumed requests (`test-d3d9-async-protocol.js`). Native handlers park with
yield reason 16 and retain their stdcall frame and render token. The root-run
`test-d3d9-render-wait.js` passes actual x86 CALL-register dispatch for all four
draw entry points, Present, Clear, EVENT Issue and final Device Release. It
checks pending retries, successful and failed completion, exactly one submission,
deferred UP stream/index unbinding, no early canonical clear or query publication,
retained native ownership after failed retirement, and balanced return stacks.
The root also reran `test-d3d-render-wait-scheduler.js` and the async bridge
protocol suite successfully. `test-d3d9-guest-render-worker.js` now joins these
layers: real x86 COM calls use the asynchronous Bridge and production WAT render
worker, then retry and publish all 64 expected canonical pixels on Present.
The test reuses UP input bytes while the guest is parked, verifies single draw
and Present submission, performs native Device Release, and proves worker exit
before successful native heap adoption. The worker receives the actual loaded
PE image base, not an assumed 0x400000. Nested schedulers save and restore the
token through native exports. Subsequent frontend tests now exercise the shipped
loops: `test-d3d9-software-cli.js` passes actual x86 COM calls through the CLI,
and `test-d3d9-software-host-web.js` passes both browser cooperative main and
guest-main Worker execution (session45867). Each renders canonical red pixels
through the production software worker, retires exactly the expected commands,
and performs native resource/heap cleanup. The browser test serves a fresh
1106419-byte canonical full-source snapshot for both modes; it does not certify
a stale on-disk artifact or the separate full build gates. Main render waits
retain readiness state while peers and the host event loop continue. This is
focused launch-loop acceptance, not all-method, full-game or performance proof.

The canonical build attempt after this slice passes the 67-fragment, memory,
dispatch, handler, test-discovery and cache-version gates, then stops at stale
toy-VM browser bundles from separately owned work. This is not a full build pass.

Cross-backend numeric correction: the real GPU LIT test initially produced
white instead of yellow for `(1,0,0,-2)`, exposing exponentiation on the unlit
branch. GLSL now matches the native VM's positive-dot-product gates and the
[Microsoft LIT pseudocode](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/lit---vs)
power clamp. The browser shader test passes after the change. This specific
red/green pixel result is not a general floating-point conformance claim.

CLI experimental controls are now wired as
`--d3d9-renderer=software --d3d9-programmable`; a bounded Notepad launch passes
with them (startup/configuration evidence only, not a D3D game test). Pure CLI
WebGL selection is rejected because no GL provider is integrated.

CLI launch-loop follow-up: ordinary Black & White execution now survives pending
render work without a diagnostic stuck-threshold override. The detector exempts
only yield16 tokens present in the live Bridge request registry; orphan tokens
are not exempt. The normal run reaches its20-second wall guard at312228 batches,
with measured execution20.009s and no STUCK report. `test-cli-elapsed-time.js`
passes, verifying that Stats uses measured execution rather than the configured
deadline. This establishes bounded launch progress, not recognizable gameplay.

Native coissue follow-up: the shader agent reports115 VM cases and real COM
software pixels passing with packet ABI2. A pair reads both result sets before
either destination is committed, and retires as one budget/cancellation unit.
Insufficient budget yields before the pair; resumption at its second packet is
rejected. Cancellation status publication is sticky. The context layout remains
unchanged; this is not a claim that multiple vector stores are hardware-atomic.

Worker scheduling measurement: `tools/bench-d3d-software.js` compares identical
800x600 fixed-strip draws using production code. In two runs, three draws at the
default256-quad worker budget took4.407–4.558s, including3.577–3.585s measured
timer waits across2814 callbacks. A4096-quad diagnostic arm took0.533–0.535s with
identical pixels. Compilation was measured separately. This identifies callback
wait overhead, not game FPS. Production workers now retain256-quad native steps
but execute up to4ms or64 steps per callback before a macrotask yield. The clock
is checked after each step, so this is not a hard real-time deadline. Explicit
adapter/custom-scheduler use defaults to one step per callback. Deterministic
deadline, step-cap, cancellation and ownership tests pass, as do the adapter and
production-worker regressions. The agent's after-run measured0.303s for the same
three draws, identical pixels and2814 native steps, with60 timer callbacks and
0.075s timer wait. Root independently reran the focused slice test successfully.
Additional worker native-execution overhead remains unexplained; no application
FPS improvement has yet been established.

Next work: real-game progression,
remaining shader arithmetic/profile legality, fixed-function lowering and broader
resource/pipeline coverage. Browser
selection is experimental (`d3d9-renderer=software` plus `d3d9-programmable`);
neither this opt-in nor a passing triangle fixture establishes complete caps.

Large-draw packing groundwork: `lib/d3d-geometry-batches.js` remaps list/strip/fan
input into ordered triangle batches with at most256 vertices and256 triangles.
Its focused test passes2950-triangle fixtures, degenerate/global strip parity,
fan hubs, INDEX32 values above65535, exact packed-byte budgets and immutable
input copies. Adapter integration now executes these batches under one shared
owner: shaders, constants and texture bytes are retained once; all bounded
native contexts validate before any target writes. Batch boundaries preserve
ordering and yield without reporting command completion. Native peak allocation
reservations include raster storage, creation workspace and two VM contexts,
using the VM's exported context-size authority. The2950-triangle native test
passes final pixel order, cross-batch blending, one shader pair/texture copy,
late preflight failure, budget rejection, source reuse, completion and cancellation.
Existing software adapter and production-worker regressions pass. Browser page
and worker load the packing helper before the software adapter. These are focused
tests, not a fresh real-game acceptance run; mip-chain sampling remains required.

Large-draw frontend evidence: the real x86/production-worker integration test now
also submits2950 POSITIONT triangles through DrawPrimitiveUP. It verifies one
Bridge submission and one queue command for the whole draw, completion only after
all batches, guest input reuse while parked, no intermediate canonical pixel
publication, final last-triangle color through Present, and graceful retirement.
Root run34560 passes. This closes the harness-level large COM draw gap, not the
Black & White gameplay gate.

Native mip phase reported by shader agent:134 VM and161 raster cases pass with
implicit quad derivatives and helper execution, including perspective-gradient
oracle, coverage/viewport/depth/discard edges and dependent texture reads. Helper
lanes influence gradients but do not write color or depth. Complete Bridge sampler
metadata and software adapter binding are still being integrated. Exact historical
GPU LOD precision remains a separate native-reference requirement.

Mip adapter follow-up: full chains now bind through the native versioned mip
descriptor, including single-level textures. The focused software mip suite
passes implicit colored-level selection, trilinear filtering, distinct min/mag,
bias/MAXMIPLEVEL, original-size residency, immutable level bytes/metadata,
malformed-chain cleanup and cancellation. Large-draw and production-worker
regressions also pass with this binding. Bridge now snapshots original dimensions,
SetLOD residency, border color, finite LOD bias and MAXMIPLEVEL; native sampler
setters accept the corresponding metadata. Nonzero bias/MAXMIPLEVEL explicitly
reject on the current WebGL adapter until accelerated lowering is implemented.
No full WebGL sampling parity or real-game completion is implied by these tests.

Directional-lighting lowering checkpoint (2026-09-10): software35236 passes
21 actual pixel cases plus malformed DLT1 descriptor checks and allocation
retirement; WebGL34697 passes44 pixel cases across forced WebGL1/2, including
fixed VS + PS1.1 v0 reading the lit material rather than raw COLOR1. Coverage
includes front/back/perpendicular directions, optional normal normalization,
inverse-transpose world scaling, eight directional lights, global/per-light
ambient, emissive, material sources/COLORVERTEX, missing-color fallback, diffuse
alpha and zero/underflow/overflow-length direction policy. Native cascade42650
passes the existing six-stage texture/transform/fog-adjacent lowering suite.
The DLT1 binder appends real native VM vertex operations and replaces its owned
VS IR/packet only after successful compilation; older cascade and vertex-input
ABIs are unchanged. Point/spot and specular lighting remain explicit gates,
as does lit programmed-PS secondary-color linkage pending conformance. No new
caps or Windows reference conformance are claimed. At this checkpoint software
fixed programs still recompiled per draw; the subsequent bounded packet-cache
slice below removes repeated packet compilation, not descriptor lowering. Complex combinations
remain bounded by the existing128-instruction native fixed-program budget.

Native fixed semantic packet cache (2026-09-10): each software Device now owns
a native LRU cache, at most64 variants and a reserved byte capacity (default
min(256KiB,maxBytes/16), opt-out fixedCacheBytes:0). Matching compares complete
native IR headers/instructions/operands, excluding only the four DEF literal
words. A hit copies immutable packet code and rebinds the current DEF prologue
in WAT; matrices, directional-light/material colors and pixel constants are not
variant keys. Shader profile/compiler version and all semantic operands remain
part of the exact comparison. Templates own detached IR/packet bytes, so
in-flight private packet copies survive eviction and cache retirement. Reset and
device destruction retire the cache; distinct devices do not share ownership.

Focused cache61583 passes actual lighting and pixel-stage factor/constant pixels with compile-count checks,
semantic changes/reuse, bounded eviction, clone-allocation OOM preserving cache
state, admission OOM returning an uncached valid program, invalid-state pixel
preservation, asynchronous execution after cache retirement, cancellation,
Reset and device lifetime. Lighting31992 passes21 pixel/malformed-descriptor
cases; fragment and logical-AND gates pass. This is packet compilation reuse,
not the final constant-binding architecture: descriptor-to-IR validation/lowering
still executes on each draw, and each draw allocates a private packet copy.
No throughput improvement or elimination of those costs has been measured.

Independent color executor checkpoint (2026-09-10): software24083 passes22
direct and22 production-worker checks; GPU67695 passes22 checks on each forced
WebGL1/2 path plus failed-FBO allocation cleanup/retry. Color formats21/22 own
separate bounded storage and preserve A/B contents across draws, clears, uploads
and readback with differing dimensions. X8 storage initializes/clears alpha255
and masks alpha writes. Shared depth identity survives color switching; pixels
outside the smaller target retain their prior depth. Present/readColor(null)
always select the implicit backbuffer, never the last offscreen color target.

GPU color resources use an authoritative color texture and per-depth-sized
staging framebuffers, sharing depth renderbuffers by identity. GPU-only load/store
copies preserve color across staging changes and handle oversized depth storage
on WebGL1 as well as2. This costs extra storage and copies; no zero-copy or
throughput claim. Failed framebuffer construction retires newly allocated color
and depth storage while retaining existing shared depth. Worker31475 adjacent
parity/order/parent-memory/readback/retirement regression passes; focused worker
cleanup verifies actual exit before native heap adoption. Generic GPU unit tests
also pass. Texture-surface alias sampling and versioned CPU/GPU synchronization
remain required next work; independent color storage alone does not complete them.

Render-target texture frontend checkpoint (2026-09-10): native
CreateTexture/CreateCubeTexture accepts default-pool, non-dynamic color targets
in formats21/22. Each face/mip owns a monotonic color identity and shares the
texture's canonical byte allocation; existing COM surface views retain their
parent, and target bindings retain that parent internally. GetRenderTarget
returns the public view, not the private storage descriptor. Texture locks
reject render-target usage; GetRenderTargetData fences the selected subresource.
Draw snapshots name color identities instead of uploading stale CPU pixels.
Final parent destruction publishes one ordered color-set retirement command.

Native61003 passes direct/software-worker mip/cube identity, independent rendered
mips, readback, view recreation, parent lifetime, feedback rejection and a real
DrawPrimitiveUP sampling previously rendered texture pixels. Browser78209 passes
actual x86 CreateTexture/surface bind/Clear/sample/LockRect and color-set retirement
through both cooperative-main and guest-main Worker production routes, with
render-worker allocation cleanup. Full build82702 passes canonical1151595 and
compat1152063; the async protocol test covers all19 private production opcodes.
Native81793 additionally verifies Reset rejection while an external backbuffer
is held, followed by successful Reset retiring an internally bound cube parent.
Existing Reset82330, viewport/scissor1293, texture34052 and cube35791 regressions
pass. The initial added Reset fixture18505 incorrectly held that backbuffer;
its failure was expected ownership validation, not a renderer failure.
Production browser81357 (`node test/test-d3d9-software-host-web.js --webgl`)
also passes the actual-x86 target/texture sampling and retirement sequence on
WebGL in both guest modes, using a real guest-created window. Software51264
passes the same revised fixture. Focused accelerated mip/cube/cache alias
verification is recorded below. General CPU dirty/version leases, migration and
complete texture formats/pools remain open, as does Black & White gameplay
acceptance.

Additional raster discrepancy measured by actual-x86 WebGL fixture21997:
a clip-space triangle (-1,1), (1,1), (-1,-1), rendered into a4x3 target using
the current half-pixel conversion, fills the top row in software but leaves it
clear in WebGL. Interior pixels agree. This exact horizontal-edge ownership
case remains an unverified/native-reference raster-conformance requirement;
no epsilon workaround or blanket parity claim has been introduced. Resource
alias tests use interior samples to isolate storage from edge coverage.

Mip-atlas shader fix (2026-09-10): `withMipSampling` now recognizes compact and
whitespace-varied GLSL main declarations, including fixed-function output.
Previously it rewrote texture calls without inserting their helper declarations
when main used `void main(){`. Shader unit regressions pass; focused alias
GPU34064 verifies real WebGL1/2 compilation and pixels after this fix. Agent
native19805 passes21 direct and21 worker alias checks, with heap adoption after
actual worker exit; final cache/retirement evidence is recorded below.

Adjacent shader-web80127 is **not** a passing regression: initial VS/PS1.1, LIT
and dependent-texture blocks pass, then its staged PS1.4 browser fixture sends
JSON-serialized `nativeBytes` rather than a Uint8Array and is rejected by the
retained native-IR contract. That fixture also predates the explicit PS1.4
production-profile gate. This failure precedes mip-atlas lowering; production
validation was not weakened to accept the obsolete diagnostic handoff.

Executor alias coverage: native97715 passes 30 shared pixel/lifetime cases in
both direct and production Worker execution, followed by confirmed Worker exit
and native heap adoption. GPU79741 passes 31 cases in each forced WebGL1/2
context plus Reset cache retirement. Coverage includes fixed and programmed
sampling, asymmetric top/bottom orientation, mixed CPU/resource mips and cube
faces, hardware mip selection and MAXMIPLEVEL atlas copies, Draw/Clear/upload
invalidation, repeated-resource cache reuse, feedback rejection without source
mutation, and release invalidation. GPU draw tests make `readPixels` throw: alias
assembly uses GPU copies, not a CPU readback fallback. Native sampling references
owned BGRA allocations directly; GPU assemblies use executor-local revisions,
not optional producer upload versions. Mixed CPU/resource assemblies are rebuilt
because CPU snapshots currently lack stable content identity. GPU scratch and
assembly copies remain an explicit storage/throughput cost, not zero-copy parity.

Final frontend rerun90202 passes the native direct/worker alias, sampling,
readback and Reset sequence. Full build7818 passes canonical1151612 and
compat1152080 with layout9c6027bce1d500a1 and no data-segment overlaps. The
recorded edge-coverage and staged shader-fixture issues remain open; this is a
resource checkpoint, not complete raster/profile or gameplay acceptance.

Shader browser fixture transport repaired (2026-09-10): shader-web97596 passes
WebGL2 and35181 passes forced WebGL1 through terminal exit0. This resolves the
recorded80127 fixture failure. The test loads the serialized native-IR reader and
restores Uint8Array bytes after Puppeteer's JSON argument boundary; ordinary
cases still use production compileNativeIR and ignore redundant JS projections.
The private PS1.4 block first asserts production-profile rejection, then uses a
synchronous test-only compileIR adapter for that block and restores production
compilation in finally. No shipping validation or capability gate changed.
Coverage again includes dependent/matrix/cube instructions, PS1.2, PS1.3 depth,
the private PS1.4 lowering subset, and manual mip-atlas/native comparisons on
both GL versions. Shader unit tests and diff checks also pass. This does not
enable or prove a complete public PS1.4 profile.

ColorFill checkpoint (2026-09-10): native ColorFill now fills supported21/22
default-pool offscreen surfaces, render targets, render-target texture views and
the implicit backbuffer. The [Microsoft contract](https://learn.microsoft.com/en-us/windows/win32/api/d3d9/nf-d3d9-idirect3ddevice9-colorfill)
defines the destination pool/types and NULL-as-full-surface rectangle. Native
validation rejects wrong devices/pools, locked targets, invalid pointers and
nonpositive/out-of-bounds explicit rectangles. Other formats remain gated by
resource creation. No new caps are exposed.

Private command30014 snapshots a destination/color/rectangle into the existing
ordered CLEAR command, with depth disabled and no dependence on current native
viewport/scissor or target binding. Both executors reuse their existing fill and
resource-revision behavior; no CPU readback fallback was added. Native20100
passes direct/worker backend bootstrap, implicit/texture/cube/offscreen targets,
subrect pixels, X8 alpha, binding/scissor preservation, validation and explicit
pending/completed stdcall-stack assertions. Browser95903 passes actual-x86
WebGL in both guest modes. Software browser38731 exposed a missing async stack
guard; the fix passes browser78448 in both guest modes. Full build6715 passes
canonical1151946/compat1152414 with no overlaps; fragment/logical-AND and20-opcode
production routing regressions pass. This does not complete other copy/resolve
operations, formats, or native-reference characterization of degenerate rects.

Rectangular color RESOURCE_UPDATE uploads now accept an optional bounded
`{x,y,width,height}` rectangle in native top-left coordinates. The software
executor updates only those rows in its owned native storage; WebGL converts
only the source rectangle and uses texSubImage2D after saving pending target
writes. Neither path reads back the destination or uploads a stale whole-surface
CPU shadow. Uploads advance the existing WebGL color revision for alias-cache
invalidation. Source pitch, BGRA conversion and X8 alpha rules are preserved.
Shared fixtures pass35 checks each through direct/worker software (45249) and
WebGL1/2 (70142), including asymmetric two-row uploads over rendered content,
untouched destination pixels and a top-edge X8 update. This is the backend
prerequisite for UpdateSurface, not completed guest API support; native source/
destination validation and texture-level routing remain to implement.

The first native UpdateSurface slice now implements matching A8R8G8B8/X8R8G8B8
system-memory sources to default-pool offscreen, independent render-target,
render-target texture/cube and ordinary texture-level destinations. The native
view resolver validates device ownership, pool, format, lock state, source RECT
and destination POINT before copying. Ordinary texture levels update canonical
bytes and dirty sequence; executor-owned color destinations submit private30015,
which snapshots source rows into ordered rectangular RESOURCE_UPDATE commands.
No whole-target CPU overwrite or readback is used for partial GPU uploads.
Async reentry polls before allocation/copy; pending calls retain their stack.
Native80316 passes direct/worker source and destination locks, bounds, offsets,
outside-pixel preservation, ordinary texture dirty sequence, RT mip/cube data
and stdcall checks. Production browser40847 software and20981 WebGL both pass
actual-x86 UpdateSurface to RT texture followed by sampling, source release and
readback in cooperative-main and guest-main Worker modes. The21-opcode bridge
routing regression passes. Implicit swapchain destinations, other packed/DXT
formats and outstanding-DC handling remain missing UpdateSurface coverage;
this is not full API/format completion and does not expand advertised caps.

UpdateSurface now also copies the other currently creatable texture formats:
X8L8V8U8 and DXT1/DXT5. Native row addressing uses the existing block-byte,
pitch and mip-row helpers, preserving compressed bits without decode/re-encode.
Compressed origins must be block aligned; partial trailing blocks are accepted
only at both source and destination mip edges. Direct/worker regression85321
passes raw-byte whole and subrectangle copies, distinct row pitches, 2x2/1x1
mip padding, invalid alignment rejection and no destination mutation on error.
The existing21/22 color/alias/readback/lifetime suite passes in the same run.
These fixtures establish implementation behavior, not a native-driver oracle
for unusual compressed edge rectangles; that characterization remains open.
No new formats are advertised, and implicit swapchain destinations remain open.

Implicit UpdateSurface destinations are now supported through the same ordered
color RESOURCE_UPDATE command (null resource means the device backbuffer).
Native validation uses the actual implicit wrapper/dimensions, not bound RT0;
the source must match its X8 format. Both backends preserve outside pixels and
WebGL addresses the logical canvas inside any oversized depth-backed target.
Native13640 passes implicit rectangle upload/Present plus GetDC exclusion and
ReleaseDC identity/double-release checks. A dedicated DxObject surface flag
tracks guest GetDC ownership: compositor DC bindings are not outstanding guest
acquisitions. Initial43971/41086 checks incorrectly used generic DC state,
which Present creates internally; the explicit ownership flag fixes this.
Backend70704/66547 pass39 checks through direct/worker software and WebGL1/2.
Actual-x86 browser81042 software and7175 WebGL pass both guest modes, including
upload/Present with an independent RT bound. Initial browser69564/43603 failed
only the fixture's expected backbuffer Release count (device ownership retains1,
not0); corrected fixture checks1. Fullbuild40843 passes1153777/1154245 bytes.

Parallel review found and fixed a software-only outside-alpha overwrite:
X8 normalization now touches only uploaded rows/columns, matching WebGL's
subimage update. The added parity fixture begins with nonopaque implicit color
and checks outside alpha through READBACK, not just the displayed image.
Review also identified a still-open GDI synchronization gap: GetDC binds the
canonical CPU buffer without fencing/downloading executor-dirty pixels, and
ReleaseDC does not upload GDI writes. The ownership flag prevents UpdateSurface
while acquired but does not solve those transfers. Full D3D/GDI interoperability
requires ordered acquire/readback and release/upload; current tests deliberately
do not establish that behavior.

Implicit-backbuffer GetDC/ReleaseDC now synchronize through the same queue.
Acquire reserves guest ownership before private30016 READBACK, publishes no HDC
while parked, then binds GDI to the downloaded native bytes. Release snapshots
those bytes once using30015/RESOURCE_UPDATE and polls on reentry; ownership and
the usable DC survive a terminal upload failure. Distinct acquire/release pending
bits exclude competing DC acquisition/release. The implicit owner is resolved
from a live D3D9 device's retained surface slot; no second rendering queue or
forged color metadata was introduced. New implicit Clear/Draw, ColorFill,
UpdateSurface, Present and Reset work is excluded while the DC is held;
already-issued calls still poll rather than abandoning completion tokens.

Native63568 passes direct/worker GetPixel after an unpresented ColorFill,
SetPixel followed by ReleaseDC/Present, held-DC rejection, wrong/double DC
release, and pending/completed stdcall assertions. The22-opcode host-routing
test passes. Browser42202 software and58134 WebGL pass the same actual-x86 GDI
round trip in cooperative-main and guest-main Worker modes. Initial97907/31683
browser failures were absent GetPixel imports in the Calc fixture; it now
resolves GetPixel/SetPixel through real GetProcAddress before calling them.
Full native/build63568 passes1154420/1154888 bytes with no overlaps. Parallel
review supplied the reservation/reentry invariants and identified the implicit
Clear/Draw exclusion fixed here. This verifies the implicit transfer slice,
not all [GetDC restrictions](https://learn.microsoft.com/en-us/windows/win32/api/d3d9/nf-d3d9-idirect3dsurface9-getdc):
non-implicit surface/texture DC support, complete
surface→device lifetime retention and multi-producer fault/cancellation coverage
remain open. Those are still blockers to full D3D/GDI interoperability.

Backbuffer GetDC admission now requires the immutable lockable bit captured from
CreateDevice presentation flags. Reset accepts LOCKABLE_BACKBUFFER and captures
it in the staged replacement surface, preserving the old surface on failure.
Native18915 passes direct/worker nonlockable rejection, Reset transitions both
ways, failed transitions preserving admission, and the existing GDI roundtrip.
Browser61376 software and11089 WebGL pass actual x86 CreateDevice with Flags1
and the GDI roundtrip in both guest modes. This does not implement implicit
backbuffer LockRect, broader creation-parameter validation, or the remaining
surface/DC formats and ownership rules.

Implicit Surface9.GetDevice now validates the output, resolves its live owner,
and returns the canonical Device9 interface with one added reference rather than
trapping. Native72381 verifies identity, null-output rejection, stdcall cleanup,
balanced reference ownership and replacement-backbuffer identity after Reset,
in direct/worker modes. Browser19382 software and17109 WebGL verify actual x86
GetDevice and balanced device references in both guest modes; fullbuild48428
passes1154554/1155022 bytes. Earlier browser33467/32939 failures were a fixture
assuming refcount1 despite live resources; the check now measures its baseline.

Independent review confirms a separate lifetime blocker: implicit surface
external references do not yet retain their device. Thus GetDevice after the
caller's final device Release is not supported correctly. Fix acquisition at
GetBackBuffer, swap-chain GetBackBuffer, implicit GetRenderTarget, AddRef and QI
with cycle-free external ownership; final surface release must stage and poll
asynchronous parent teardown without double-decrementing on reentry or retiring
storage after a failed handoff. GetDevice alone does not resolve that blocker.

That implicit-parent retention gap is now implemented: shared external acquisition
retains the parent only at baseline1→external2; all further surface references
share that hold. Device/swap-chain GetBackBuffer, implicit GetRenderTarget and
Surface AddRef (including QI) use it. Internal baseline teardown remains raw
surface release, so no cycle is introduced. Last external release calls parent
Release with both counts unchanged until completion. Pending reentry polls;
failure preserves both owners; success then drops the external surface reference.
The parent call and surface call share the same one-argument stdcall epilogue.

Native36809 passes direct/worker mixed getter/QI references, original device
Release followed by GetDevice and rendering, last-reference retirement,
immediate injected retirement failure followed by successful retry, and parked/
terminal stack cleanup. Browser54231 software and90328 WebGL pass actual x86
last-surface retirement in both guest modes, including final executor cleanup.
Fullbuild81333 passes1154735/1155203 bytes. Independent review checked the
deferred-decrement scheme. Multi-producer races, asynchronous fault injection,
broader swap-chain semantics and implicit LockRect remain separate open gates.

Delayed final-backbuffer retirement failure now has two targeted tests.
Native46980 executes real x86 Surface.Release calls with controlled private
completion: multiple pending polls keep surface2/device1 and canonical pixels,
failed completion returns2 without freeing either owner, and a new successful
attempt submits once and returns through the original stack exactly once.
Native40611 adds real Bridge._result/_poll tokens in direct and worker-backed
fixtures: a controlled promise rejection before30004 admission preserves owners,
then an ordinary production retry retires the backend. These tests prove native
continuation handling, not recovery from an admitted executor retirement fault.
Such faults may retire the shared worker; the host releasing/lost state and
multi-producer cancellation remain distinct lifecycle gates. Test manifest and
diff checks pass; no runtime source changed in this test-only checkpoint.

Implicit lockable backbuffers now implement LockRect/UnlockRect through the
existing canonical READBACK and immutable upload commands. CPU ownership is
shared with DC exclusion, with distinct LockRect-kind and READONLY bits;
acquire/release reservations prevent overlapping access while parked. Lock
returns full pitch and a canonical DIB pointer offset to the validated subrect.
READONLY unlock emits no upload. Failed acquire clears transient ownership;
failed upload preserves the lock for retry. Existing implicit Clear/Draw,
ColorFill, UpdateSurface, Present and Reset exclusions cover both access kinds.

Native75402 passes direct/worker full-pitch/subrect pixels, mutual DC/Lock
exclusion, nested/unbalanced call rejection, READONLY upload omission, and
injected immediate transfer failures followed by retry. Browser30303 software
and89176 WebGL pass actual x86 lock/write/unlock/Present in both guest modes.
Fullbuild71001 passes1155326/1155794 bytes. Current lock flags are0, READONLY and
NOSYSLOCK; DISCARD/DONOTWAIT/NO_DIRTY_UPDATE remain unimplemented, not silently
accepted. Unlock currently uploads the fully synchronized X8 buffer, preserving
surrounding RGB but normalizing X8 alpha; dirty-rectangle upload optimization,
pending argument-mutation/multi-producer tests and broader surface formats remain
open. This does not complete the resource/locking profile.

Programmed vertex pixel-center conversion (2026-09-10): the solid GPU path now
applies the same `(1,-1)*clipW/viewportExtent` displacement as the fixed vertex
path, including nonzero viewport origins. Previously programmed VS coordinates
were left at GL half-integer centers while native/fixed paths used D3D integer
centers. This is a viewport conversion, not an epsilon-based edge fix. Native
triangle masks21686 pass20 cases; GPU58160 passes20 fixed/programmed equivalence
checks across forced GL1/2. Shader regressions88630 (GL2) and54316 (GL1) pass,
including mip/LOD and TEXKILL helper checks; their UV input offsets were adjusted
to preserve the same independently specified native sample coordinates.
Extended native91685 and GPU27844 gates pass34 cases/comparisons each, including
constant W2, varying W(.5,2,4), fractional coverage, and repeated viewport
extent/origin changes on one device. The accelerated reuse case checks exact
fractional masks and one cached program throughout the viewport changes.

Integration build40591 passes after the concurrent monitor gate update:
canonical1155969 / compat1156437 bytes, layout9c6027bce1d500a1, no data overlaps.
Test manifest and whitespace gates also pass. This supersedes the earlier
monitor-inventory/PaintRect build interruptions; it does not close the remaining
renderer profile or gameplay gates.

Full triangle edge parity is still open. The coverage fixture reports exact
horizontal-edge differences and supports `--require-parity` to turn those into
a failing gate. Microsoft specifies integer centers and top-left ownership in
[D3D9 rasterization rules](https://learn.microsoft.com/en-us/windows/win32/direct3d9/rasterization-rules).
Khronos [ARB_clip_control issue9](https://registry.khronos.org/OpenGL/extensions/ARB/ARB_clip_control.txt)
leaves exact shared-edge ownership implementation-defined: neither an epsilon
nor a global Y flip proves conformance. The proposed GPU2 exact path must retain
homogeneous clipping, original culling, per-pixel top-left edge tests, perspective
varyings, original raster depth, helper execution before coverage suppression,
and depth/stencil/blend/query ordering. Transform-feedback output can be copied
GPU-to-texture through a pixel-unpack buffer to avoid tripling attribute/varying
requirements; that coverage implementation is not yet present. GL1 remains an
explicit hardware tie-rule subset. Binary-exact test coordinates isolate edge
rules; arbitrary transform/subpixel-rounding parity is a separate open issue.

The next lock checkpoint replaces whole-buffer upload with immutable rectangular
uploads. Five per-device snapshot words capture output WA and x/y/w/h before
parking; pending acquisition no longer rereads mutable guest rectangle/flags.
Rejected nested locks cannot replace the active snapshot. Unlock uses captured
source offset/full pitch and destination bounds, preserving outside RGB and
alpha while normalizing only uploaded X8 pixels. DC release remains full-surface.
Program allocation/zeroing grows from22024 to22044 bytes; independent audit found
no separate allocation-size mirrors, and Reset allocates fresh zeroed snapshots.

Native32862 passes direct/worker invalidated-rectangle reentry, unchanged pending
output, nested-lock snapshot preservation and outside-alpha checks. Browser24426
software and64983 WebGL pass actual x86 partial LockRect/UnlockRect/Present,
mutated guest RECT and exact inside/outside alpha in both guest modes. Shared
fullbuild95791 reached the silent-handler inventory gate then stopped during
concurrent monitor-handler work (353 versus356 baseline); its owner was notified.
That full-build result is not a pass; browser compilation and focused tests are
the current evidence for this checkpoint.

Live B&W24571 has now passed the profile-creation blocker using the frozen
PathGetCharType implementation: normal Return224427/up224621 closes the dialog
and the inspected menu capture is headed Player. This verifies progression
beyond the prior native API trap, not gameplay. New Game click225653 and held
mouse226972→228211 were delivered, but settled capture229794 remains at the menu.
The run is still live with zero reported renderer failures; the frozen snapshot
predates recent lock/ownership and programmed-VS corrections. See the B&W RE
notes for artifact paths and exact inputs; no guest state was patched.

Fullbuild76498 passed the updated silent-handler inventory, then stopped on four
raw PaintRect accesses in concurrent monitor work in09a-handlers.wat. The owner
was notified; full-build revalidation of the latest snapshot change is pending.

Software homogeneous clipping audit: native98252 passes74 coverage cases,
including40 new analytic clipping checks for near/far/all four sides, varying W,
both windings, simultaneous near/left clipping, exact on-plane vertices,
negative W and nonzero vertices at W=0. Expected projected polygons are specified
independently rather than produced by a second clipping implementation. Query
sample counts equal the unique expected pixel masks, checking clip-fan ownership
as well as visible coverage. Adjacent native pipeline55231 passes351 shader,
varying/depth, clipping, helper, lifetime and cancellation cases. Inspection and
these tests found no concrete software clipper defect; no WAT change was made.
Arbitrary subpixel rounding and GPU hardware tie-rule equivalence remain open;
this evidence does not assert universal Windows hardware conformance.

B&W run24571 has now activated New Game via ordinary mouse input. The game had
recorded earlier clicks at native(0,0), unlike the host's absolute pointer.
Separate relative movement, verified native cursor(194,556), down287458 and
up288497 lead to a controls/tutorial Continue screen in settled capture290202.
The diagnostic trace range is restored and the mouse released. See the RE notes
for native dispatch/coordinate evidence; no guest-state patch or restart was
used. This advances menu-to-game acceptance but does not yet prove changing
in-world gameplay, current-build rendering, or parity with WebGL.
Continue down293970/up294751 subsequently reaches a trap at batch294774,
EIP00925197; run24571 has exited1. Runtime instruction bytes differ from the
supplied executable inside a buffer-copy routine, so corruption/copy arguments
are the next investigation, not an assumed unsupported shader or x86 opcode.
The saved stack subsequently proves dest0/count00a58780 after an unchecked
aligned-allocation failure. The exact REP/cursor sequence passes16 valid-buffer
cases on the frozen artifact, current build and fresh source77739; no REP fix
was warranted. Fresh current-build reproduction21705 is live for allocation
state investigation. Neither memory-pressure cause nor gameplay is yet proved.

Allocator pressure checkpoint: successful low/sparse arena replacement now
publishes the old unused aligned tail (minimum16 bytes) to that instance's free
list. Previously rollover stranded those bytes until no caller could reuse them.
The validated helper is shared with graceful render-worker heap retirement;
failed replacement preserves the old current arena, and low-to-sparse spill
retains the still-current low tail rather than duplicating it on a free list.
The failure fixture also exposed oversized low allocations admitted through
g2w's unmapped sentinel. Bounds now compare the requested guest endpoint with
the known low-region guest boundary before falling back to sparse allocation.

Final focused46177 passes11 cases, including16/24/64-byte reuse,8-byte padding,
peer isolation, live guards, genuine1GiB reservation rejection and retry.
The pre-fix frozen artifact fails the first tail-publication assertion. Heap
partition72931 and production software-worker99596 pass; earlier heap header
validation and heap-handle tests pass. Full build97264 passes canonical1155999 /
compat1156467, unchanged layout9c6027bce1d500a1 and no overlaps. These are real
memory-budget fixes, not proof that B&W's10.3MiB allocation now succeeds.
Active run21705 is deliberately preserved on its pre-tail frozen snapshot.

Prepared software contexts now release unused worst-case clipping capacity
before the next batch is prepared. Vertices remain in place; indices and POINT
size sidecars move into the smallest compatible sevenfold layout. An internal
nonmoving heap shrink returns the unused suffix to the owning free list.
No vertex shader is reexecuted, and every batch still completes validation
before any raster writes. The host reserves the original creation peak, then
charges a conservative retained bound including VM/binder slack. This reduces
multi-batch retained memory without weakening preflight or deferred lifetimes.

Native compaction89280 passes25 cases: analytic clipping and zero output,
actual heap-header shrink, allocator reuse/overwrite of the freed tail while
the context is live, POINT scalar relocation, wire edge provenance, an
800-triangle draw under a budget that rejects the old summed creation bounds,
exact pixels/sample counts, and late-batch failure with no writes or retained
budget leak. Heap-shrink10519 passes30 low/sparse alignment, ownership, live
guard, invalid-input and repeated-shrink cases. Pipeline1308 passes351,
PSIZE36512 passes, and edge62951 passes74. Production software-worker55789
passes real-WAT parity, ordering and cleanup. Full build22476 passes
canonical1156377 / compat1156845 with no data overlaps; test-tier gates pass.
These establish bounded-context improvements, not resolution of the separate
B&W guest allocation failure or complete gameplay/backend parity.

Private VS2.0 foundation (2026-09-11, integration still in progress): a
length-aware native decoder now accepts a bounded straight-line ALU subset,
DCL/DEF, ABS and scalar MOVA, with explicit a0.x relative operand tokens and
c0..c255. Public compilation/version gates remain closed. Native validation
26688 passes84 legality, initialization, malformed-length, lifetime and IR
budget exhaustion/recovery cases. Flow, matrices and remaining mandatory
instructions are not covered by this private subset.

The private SIMD compiler preserves the legacy register/sampler layout and
appends8192 bytes for c128..255, increasing context bytes to73760. MOVA uses
nearest-even; VS1.1 MOV-a0 retains its existing floor policy. Microsoft's
[MOVA contract](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/mova---vs)
specifies nearest rounding; the tie rule here is an explicit adapter policy,
not a claim that every historical native driver used it. Native73562 passes22
cases including high DEF constants, cross-boundary relative gathers, inactive
lanes and out-of-range/nonfinite indices. Legacy VM61145 passes231 and software
pipeline47259 passes351. Production worker18054 and compaction18592 also pass.

Private JS IR projection and GLSL lowering require experimentalVS20 explicitly;
the production native-IR handoff and guest token parser still reject VS2.
Browser34907 passes22 real WebGL1/2 cases for signed nearest-even conversion
and constant selection across c95/c127/c255. That fixture constructs normalized
IR independently. Follow-up44235 passes26 WebGL1/2 frames against13 native
raster frames using the same detached, native-validated IR and immutable DEF
constants, including signed/tie/out-of-range MOVA and actual vertex positions.
This still does not exercise production upload of256 runtime constants; that
frontend binding remains96-gated. Review also found and fixed GLSL's private
high-DEF bound and point-size saturation rejection to match admitted native IR.
No VS2 capability, full shader profile, or real-game acceptance is claimed.
Full build41098 passes canonical1158838 / compat1159306, unchanged region
layout and no data overlaps. The earlier build32355 caught an instruction
control-bit literal in the test that coincided with a region boundary; the
fixture now constructs that bit from its index without weakening the ratchet.

Private VS2 matrix follow-up: M4x4/M4x3/M3x4/M3x3/M3x2 now enter the same
existing SIMD and GLSL matrix lowering. Native decoding validates exact result
masks, consecutive row extents, every temporary row's initialized components,
input declarations/read ports, destination/source aliases and expanded slot
cost. Static rows must fit their register bank; dynamic a0 offsets retain the
bounded gather's zero result outside c0..c255. High-constant row addition occurs
before physical c128 remapping, with no new context layout or matrix kernel.

Native IR45821 passes165 matrix cases; VM70172 passes85 including real decoder
integration, all five shapes, high constants, relative bounds and TEMP/INPUT
matrix rows. Legacy VM25394 passes231; private foundation87403 passes22;
private decoder94950 passes84. Full build90152 passes canonical1160325 /
compat1160793 with no data overlaps and unchanged region layout. Final34566
passes86 WebGL1/2 frames against43 native frames: both basis and fractional
nonzero-W vectors, all five shapes, independent dot products and exact oPos.
Public VS2 admission
remains closed; these tests do not establish the remaining mandatory profile.

LOG zero conformance correction: a new signed-zero SIMD regression first failed
with negative infinity in every output component (94114). LOG now returns
finite -FLT_MAX for either sign of zero, as specified by Microsoft's
[LOG reference](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/log---vs),
in both the native handler and GLSL expression. The internal log2 helper remains
unchanged because texture LOD relies on its negative-infinity zero result.
An older transcendental fixture incorrectly expected infinity and was corrected;
native VM84880 passes233 cases, including both LOG and LOGP signed zeros.
Follow-up25349 passes263 cases, covering all four scalar replicate swizzles,
partial destination masks and inactive SIMD lanes without changing their bits.
The logical-operand gate2460 and diff check pass; software pipeline18418 passes
351 cases. Full build55260 passes canonical1161350 / compat1161818 with no data
overlaps and unchanged region layout. Actual WebGL64112 passes8 LOG signed-zero
pixel controls (current white, old unguarded expression black), in GL1 and GL2; this
does not admit another profile.

Private EXPP lowering follow-up: opcode78 selects the existing replicated EXP
packet for VS2, retaining the VS1 mixed-vector packet. GLSL makes the same
profile distinction. Microsoft's
[EXPP reference](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/expp---vs)
specifies the different results. Native67825 first rejected the new private
fixture; after lowering, VM17805 passes54 cases, including32 VS1/VS2 comparisons
across all replicate swizzles, .w-only/full writes and active/inactive lanes.
Follow-up56591 passes55 with a malformed nonscalar selector rejected; legacy
VM90197 still passes263. The private VM requires replicate swizzles for EXPP.
Decoder admission is still
pending: it must also require the selected scalar to be initialized for .w-only
writes (the shared VS1 read-mask rule correctly omits that read). Public token
and VM profile gates remain closed. Full build63947 passes canonical1161403 /
compat1161871 with unchanged region layout and no data overlaps. Actual GPU64112
passes8 EXPP profile cases in GL1/2 at +/-1.5, preserving mixed VS1 results and
replicating VS2 results. Its22 earlier MOVA/constant cases also pass.

Reuse-first private arithmetic follow-up adds EXP/LOG/LIT/DST/LRP/LOGP to the
private VM/GLSL admission lists, reusing the existing SIMD handlers and GLSL
expressions. Scalar EXP/LOG/EXPP/LOGP operands require replicate swizzles in the
private packet validator. Native85060 first rejected the new fixture; 81896
passes106 cases including48 independent mathematical/mask/lane cases and
malformed nonscalar sources. Native token admission remains pending (including
LIT/LRP expanded slot costs); this is backend groundwork, not a profile claim.
Legacy VM89462 passes263 and software pipeline99290 passes351. Full build75560
passes canonical1161429 / compat1161897, unchanged region layout and no data
overlaps. The first matrix GPU run31245 passes56 frames; strengthened34566
passes86. GPU64112 passes38 baseline/LOG/EXPP cases. Remaining arithmetic GPU
conformance and native token admission are subsequent work, not established by
these fixtures. Real Black & White gameplay and full profiles remain open.

Review caught an LRP numerical counterexample before checkpoint: with weight2
and identical finite endpoints2e38, the weighted-sum expression overflowed to
infinity. Native29868 reproduced the failure. Private VS2 packet flag64 and
GLSL now use the documented difference form `a*(b-c)+c`; legacy lowering is
unchanged. VM86058 passes107 cases, including the exact finite-endpoint result,
and legacy96710 passes263. GPU66016 passes40 cases including both GL1/2 finite
LRP endpoint oracles. Full build52807 passes canonical1162139 / compat1162607,
unchanged region layout and no data overlaps (includes concurrent OLE strong-lock
work, silent baseline345). No private arithmetic token admission is claimed.

After checkpoint272fdb75, private arithmetic token admission is implemented:
EXP/LOG/LIT/DST/LRP/EXPP/LOGP use the existing native IR schema. Scalar replicate
checks and selected temporary-component initialization include EXPP.w's VS2
dependency; LIT/DST keep their precise component dependencies. LIT costs3 slots
and LRP2 against the256-slot limit, with existing read-port and relative-constant
rules retained. The public compiler still rejects VS2.

New fixture53094 was RED at EXP error16;56890 passes195 cases after admission.
Existing private32078 passes84, matrix28171 passes165, legacyIR67578 passes;
logical81529, fragment, region and diff checks pass. Expanded same-IR replay6190
passes100 actual WebGL1/2 frames against50 native position/raster frames, adding
all seven arithmetic instructions with independent exact-binary expectations.
Full build5124 passes canonical1162212 / compat1162680 with unchanged region
layout and no data overlaps. Flow control,
remaining arithmetic instructions and complete VS2 capability admission remain
open; this is not a full-profile or Black & White gameplay result.

Private CRS/NRM follow-up: new packets55/56 perform SIMD cross product and XYZ
normalization with the existing source fetch and masked-write machinery. NRM
scales W too; zero squared length selects finite FLT_MAX before multiplication.
GLSL uses explicit XYZ length and zero handling, not `normalize(vec4)`. Native
evaluation uses ordinary f32 multiply/add/sqrt/divide, with no claim of matching
every GPU's subnormal/overflow behavior. CRS leaves unwritten W untouched.

Token validation requires temporary destinations and rejects source aliases;
CRS permits masks1..7 and identity swizzles only, with precise per-component
dependencies. NRM allows masks/swizzles with XYZ plus selected-W dependency.
Costs are CRS2/NRM3. Native42687 was RED;20088 passes164 new IR cases. Existing
private84/matrix165/arithmetic195/legacyIR pass82368/67813/79583/26029.

VM71586 was RED before admission;95966 passes502 private VM cases, covering all
vector masks, active/inactive lanes, NEG, six NRM swizzles, signed zero, finite
zero-length W and malformed operands. Legacy5503 passes263; logical34455 and
diff checks pass. GPU39118 passes52 cases including12 CRS/NRM cases in GL1/2.
The zero-length-W oracle keeps its second scale in the fragment shader to avoid
combining two vertex scales into a subnormal; no production bug is claimed from
that initial test failure. Same-IR39570 passes106 GPU frames against53 native
frames; its initial failure47567 was a duplicate NRM case identifier that paired
the zero-vector output with the nonzero-vector expectation. IDs now include the
input vector. Full build11204 passes canonical1162831 / compat1163299, unchanged
region layout and no data overlaps. Software pipeline71393 passes351 cases.
Independent read-only review found no concrete packet/validation/masking defect;
this adds no claim of Windows-driver numeric equivalence. Public profile gates
remain closed.

Private POW follow-up: opcode32 lowers to packet57 with four-lane SIMD
log2/multiply/exp2 and to GLSL from the same validated IR. Both scalar sources
require replicate swizzles; the destination must be temporary and distinct from
the exponent (base alias is legal). Decoder dependency tracking reads the
selected scalar regardless of destination mask and charges three slots.
Public VS2 and legacy opcode admission are unchanged.

The finite-input adapter zero policy is explicitly x^0=1, 0^positive=0 and
0^negative=+Infinity; Microsoft's POW page does not specify this zero table.
The native path uses internal log2's negative infinity, not standalone LOG's
finite sentinel. GLSL guards zero domains explicitly. Nonfinite/subnormal
cross-driver equivalence is not claimed. Browser zero-base fixtures use a normal
small exponent: the initial subnormal exponent was flushed to zero by the driver.

Evidence: decoder RED53335 ->3132 PASS210; native RED28876 ->11584 PASS954,
including a 1024-sample composite accuracy sweep over normal results with maximum
relative error 0.000004101193076699872 (bound2^-15), masks, scalar selectors,
active lanes, legal aliases and malformed-IR rejection. Legacy13021 PASS263.
GPU33167 PASS70 includes18 new POW frames. Same-IR82549 PASS116 GPU frames vs58
native position/raster frames, adding five POW cases. Full30028 PASS canonical
1163611 / compat1164079, unchanged layout and no data overlaps. Remaining
arithmetic, flow control and complete profile/gameplay acceptance remain open.

Private SGN follow-up: opcode34 lowers to SIMD packet58 and ordered component
comparisons in GLSL. Only src0 is evaluated; two distinct bounded temporary
scratch operands are validated as clobbers rather than initialized reads.
Decoder validation invalidates both scratch definition masks after reading src0
and before publishing destination writes. Overlap with source/destination is
accepted with destination-written components superseding clobbering; this is
explicit adapter policy where the primary instruction page does not specify
overlap. NaN-to-positive-one follows the literal ordered-comparison pseudocode,
not measured Windows-driver evidence. Signed zero produces positive zero.
Public VS2 and legacy opcode admission remain unchanged.

Evidence: native RED52300 ->31153 PASS1205, covering every destination mask,
four swizzles, NEG, inactive lanes, signed zero, infinities, NaN policy, aliasing
and malformed scratch operands. Decoder RED62799 ->33698 PASS137 including
uninitialized scratch acceptance, clobber/read rejection, reinitialization,
selected source dependencies and three-slot accounting. Prior decoder suites
pass98324/53764. GPU RED8708 ->33630 PASS80 (10 new SGN GL1/2 cases), with scratch
values absent from generated GLSL. Legacy82913 PASS263; software pipeline26583
PASS351; full88845 PASS canonical1163901 / compat1164369, unchanged region layout
and no data overlaps. Independent read-only review found no concrete defect.
Same-IR55356 PASS120 actual GL1/2 frames against60 native position/raster frames,
including uninitialized scratches and reverse-swizzled/negated signs mapped to
visible colors. SINCOS, flow and complete profile/gameplay gates remain open.

Private SINCOS follow-up: opcode37 / packet59 uses ordinary four-lane
SIMD Taylor polynomials (sine degree17, cosine degree16) on the documented
[-pi,+pi] domain. Native73923 passes1520 cases including a 1024-angle sweep with
maximum absolute error3.7030587629605094e-7 against independent JS sin/cos,
bounded by2e-6 in the test. The driver reference permits0.002 absolute error.
The helper makes no host math calls and generates no runtime Wasm. Native
RED46272 confirmed the missing opcode before implementation. Legacy33994
passes263; full37288 passes canonical1164618 / compat1165086, unchanged layout
and no data overlaps.

Decoder42062 passes84 SINCOS cases; neighboring suites42062/25097 pass. TEMP
destination masks1/2/3, scalar angle, source/destination non-aliasing, two
distinct coefficient-register indices and eight slots are checked. VS2 clears
XYZ definition bits before publishing written XY, preserving W's definition.
General coefficient modifiers/swizzles/relative syntax remain available; the
same encoded index is conservatively rejected even across relative/static
operands. Required effective coefficient values remain a runtime valid-program
contract. Mathematical lowering is not a claim to reproduce a driver's exact
macro expansion or behavior with invalid coefficient values. The primary driver
page's coefficient signs/denominators conflict internally, so its literal table
is not an independent numeric oracle. Public profile gates remain unchanged.
GLSL emits mathematical cos/sin with the existing masked assignment, retaining
W; behavior outside the documented angle domain is not a parity claim (the
software helper continues its polynomial). Actual GPU93447 PASS90 includes10
new SINCOS GL1/2 cases; undefined XYZ are redefined before color observation.
Same-IR69392 PASS138 GL1/2 frames against69 native frames. Nine new cases cover
0 and +/-pi/2 with masksX/Y/XY and exact stable UNORM pixels; only their position
comparisons use the explicit2e-6 arithmetic tolerance. Every older position
check remains exact. VM68401 repeats1520 PASS with Taylor-derived coefficient
vectors seeded. Full profiles, flow control and changing gameplay remain open.

Private typed-definition follow-up: DEFB47 and DEFI48 now retain raw DWORD
immediates in the shared IR and lower to software packets60/61 or GLSL typed
constants. Definitions are stably hoisted with last-definition precedence and
consume zero guest instruction slots. The private canonical subset requires
full destination selector15, no modifier, and b0..15/i0..15; this is not a claim
that every other native DEFB mask encoding is invalid. Boolean execution maps
any nonzero DWORD to TRUE; integer definitions preserve signed32 bits, including
INT_MIN and words that would be NaNs if interpreted as floating point.

The software context appends320 uniform bytes (i registers at73760, b at74016,
total74080), leaving all previous offsets unchanged. Definitions execute through
the same bounded packet retirement/cancellation loop; inactive invocation lanes
do not partially initialize uniform constants. New contexts default to zero.
GLSL uses const bool/highp ivec4 and a safe INT_MIN literal expression. API
integer/boolean constant uploads and control-flow consumers remain unfinished;
the rendered tests use explicit test-only witnesses, not newly admitted typed
arithmetic. WebGL1 full32 integer execution precision is not established.

Evidence: native RED95562 rejected the missing opcode;36355 PASS1568 including
all16 indices, exact raw words, malformed operands, late/duplicate definitions,
one-packet resumption, context isolation and legacy rejection. Legacy VM263 and
software pipeline76330 PASS351 remain green. Decoder23564 PASS84 baseline and
100 typed cases; adjacent arithmetic/matrix/vector/POW/SGN/SINCOS suites pass.
Actual GL1/2 run41089 PASS94 includes four new typed-definition witnesses.
Independent native review found no concrete defect. Full12282 PASS canonical
1165086 / compat1165554 with unchanged layout9c6027bce1d500a1 and no data
overlaps. Public VS2 admission, full profile coverage and gameplay remain open.
Reader review additionally found that projection discarded noncanonical typed
immediate selector/modifier fields. The private typed reader now rejects those
fields (legacy DEF unchanged); RED missing-exception ->35637 PASS typed100 plus
raw-reader rejection fixtures. Same-IR regression86702 PASS138 actual GL1/2
frames versus69 native frames; these are the existing arithmetic/raster cases,
not typed control-flow acceptance.

Private static Boolean flow follow-up: IF40/ELSE42/ENDIF43 now work through the
native decoder, packet compiler/executor and GLSL. The canonical private IF
source is b0..15 with identity selector228 and no modifier; other Boolean source
encodings remain unclaimed. The [Microsoft nesting limits](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-vs-instructions-flow-control)
limit VS2 IF+ELSE static flow count to16. The profile-specific
[instruction table](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-vs-instructions-vs-2-0)
lists IF as three slots while its individual page says one; this private
validator conservatively uses three, with ELSE/ENDIF one each. This discrepancy
is explicit policy pending stronger native evidence, not a conformance claim.

Decoder validation rejects orphan/duplicate/unterminated blocks and intersects
temporary-component, address-register and position initialization at joins.
The absent-ELSE path uses entry state. A bounded640-byte temporary validation
stack is freed on every normal success/error return; repeated malformed-input
tests check actual heap allocation reuse, not only IR-byte accounting.
Software packets62/63/64 resolve forward targets after stable DEFx hoisting.
Uniform Boolean conditions select whole invocation batches without a divergent
runtime stack. Skipped instructions do not retire; visited packets share the
existing budget, resumption and cancellation mechanism. Malformed backward or
out-of-range targets fail before retirement. GLSL emits structured branches and
Boolean uniforms for inputs without DEFB; actual COM constant uploads remain
future work, while tests explicitly bind uniforms or verify their zero default.

Evidence: native RED30559 ->76705 PASS1591 ->93453 PASS1612, including sixteen
nested IFs, each possible false level, high-bit Boolean values, late definitions,
inactive lanes, no-ELSE behavior, cancellation and corrupted target rejection.
Legacy VM263 and software pipeline64510 PASS351 remain green. Decoder44479
PASS151 structure/merge/lifetime cases. Actual WebGL20651 PASS110 includes16 new
flow cases; same-native-IR84551 PASS150 GL1/2 frames against75 native frames,
including six new exact-position/pixel branch cases. That parity fixture also
corrects the earlier Taylor-derived SINCOS coefficient from -1/16 to -1/8;
coefficient values remain a valid-program contract, not measured SDK expansion.
Independent branch-link/runtime review found no concrete defect. Full47981
PASS canonical1166216 / compat1166684, unchanged region layout and no data
overlaps. Loop/REP/call/dynamic flow, full profiles, frontend typed constant
binding and changing B&W gameplay remain open; public VS2 admission is unchanged.

Private REP follow-up: REP38/ENDREP39 now use integer source i0..15 with the
same private identity/no-modifier canonical syntax. The documented
[REP contract](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/rep---vs)
uses i.x counts0..255, ignores yzw, leaves the integer register unchanged and
prohibits IF/REP straddling. The validator enforces one active REP level and
the shared IF+ELSE+REP static count16; REP/ENDREP consume three/two slots.
Tagged56-byte frames expand temporary validation storage to896 bytes, always
freed. Loop-exit initialization intersects entry state because zero iterations
are possible. Per-iteration must-write masks and entry-dependent reads also
check the backedge: an initialized read cannot become undefined on iteration2
through SGN/SINCOS clobbering. Inner IF joins merge must-write masks. Matrix rows
and selected source components participate; a0 currently has no clobber operation.

Native packets65/66 carry paired exit/body targets resolved after hoisting.
The context appends16 bytes (body PC74080/end PC74084/remaining74088/reserved74092),
total74096 with all older offsets unchanged. Positive count is captured once;
ENDREP decrements a private counter and jumps to the body, not the REP packet.
Zero skips the body. Paired targets, active state and indices are checked;
invalid runtime counts fail explicitly with status-5 rather than clamping.
Budget/cancellation checks remain at every visited packet boundary.

GLSL uses a constant255 loop bound with an early break for the valid count,
including WebGL1. Last-wins DEFI values are hoisted; known used counts outside
0..255 are rejected. Absent DEFI produces an integer uniform plus descriptive
integerUniformRanges metadata. **Dynamic API range validation is not yet wired**:
invalid externally bound GL counts can diverge from the native error behavior.
No invalid-domain parity or complete public profile is claimed; frontend typed
binding must enforce this before public admission.

Evidence: initial native test was blocked by an unrelated unbalanced DirectDraw
edit. Read-only in-memory substitution of that fragment's committed version
confirmed missing-opcode RED67795 without altering its owner file. Subsequent
ordinary current-tree36411 PASS1662 covers0/1/2/17/255, all16 integer indices,
inactive lanes, one-packet resumption, count capture, cancellation, invalid
counts/targets/nesting and IF combinations; legacy VM263 passes. Decoder87738
PASS144 ->89779 PASS148 adds selected-component and matrix-row backedge cases.
Final25378 passes flow151 (896-byte reuse after a coalescing warmup), baseline84,
typed100, SGN137, SINCOS84, matrix165 and legacy IR. Actual GL2291 PASS126 includes
16 new cases; same-native-IR32823 PASS162 GPU frames versus81 native frames adds
six exact-position/pixel REP cases. Pipeline28432 PASS351; full64782 PASS
canonical1170072 / compat1170540, unchanged layout and no data overlaps.
Independent loop-link/runtime review found no concrete defect. LOOP/ENDLOOP,
calls, full profiles, typed frontend binding and changing gameplay remain open.

### Typed constant API and software transport integration (2026-09-11, WIP)

All eight D3D9 integer/boolean Get/Set methods now use native device-owned
banks: sixteen ivec4 and sixteen BOOL registers per stage. Device state appends
640 bytes (total22684); selective recorded state blocks append64 selection
bytes and640 value bytes (total23068). Complete ranges are validated before
copying or changing selection masks. Recording changes the block, not live
state; Capture/Apply preserve selection, and successful Reset clears the banks.
Raw BOOL words round-trip as an explicit adapter policy; execution normalizes
nonzero values. This is not a native BOOL-bitpattern oracle. Full CreateStateBlock
ALL/VERTEX/PIXEL modes remain unimplemented.

Draw snapshots detach all four typed banks through the existing neutral queue.
The software adapter packs640 bytes once per draw and binds them before vertex
execution through an additive typed constructor, preserving the128-byte raster
descriptor. Native shader contexts copy these bytes, so caller reuse is safe.
Shader definitions execute afterward and retain their overriding semantics.

Evidence: native API suite26734 PASS92, existing selective stateblock/lightstate/
software COM/direct-worker query chain63911 passes. Actual COM bridge32835 passes
four-bank transport and mutation-after-submission checks: VS values are inspected
at constructor entry (its VM retires before return), PS values in the retained
native context. Pipeline62754 PASS364 independently checks actual VS pixels,
raw signed data, BOOL normalization, source reuse, invalid pointer bounds and
DEFB/DEFI overriding an otherwise invalid external REP count.

Bridge85634 also passes20 malformed-bank cases which reject before native
storage access. Verification is not complete: software-backend suite40560 fails
at its PS1.4 raw-token sampler5 fixture with native IR error2. Read-only baseline
run7719 reproduces it using committed WAT and software adapter source: the public
IR entry accepts PS1.1–1.3, not PS1.4. This is a pre-existing test/admission gap,
not a typed transport regression; no capability gate was widened to hide it.
Full build43529 stops at the shared silent-handler inventory
check during concurrent DirectSound work. GPU typed uniforms/range validation
are under separate integration testing. Public profile gates remain unchanged.
Review also identified the existing one-shot8192-packet vertex constructor
budget: valid long REP programs require resumable vertex/setup work, not an
increased blocking loop or a claim of full raster/profile support.

### Resumable vertex and clipping setup (2026-09-11, WIP)

An additive native deferred constructor now owns packed input bytes and typed
constants before returning pending. A64-byte setup record retains the vertex
group cursor and clipping progress; the shader VM retains packet PC across
yields. `d3d_software_prepare_step` takes separate packet/primitive budgets.
Pending contexts reject binders, do not write target pixels, and cannot claim
the smaller retained allocation bound. Cancellation/error retirement covers
setup state, packed inputs, VM contexts and clipping workspace. Existing
synchronous constructor callers still return ready or failed.

Both direct draw and async draw now use the same setup state machine in the
software adapter. Split batches prepare serially; each ready context compacts
before reserving the next peak. All setup/binding succeeds before rasterization
begins. Async callbacks use1024 packets and8 primitives per native setup step,
with the existing elapsed-time and step-count scheduler bounds. Deferred direct
API inputs use the queue's existing bounded copy routine, exported for reuse;
snapshot storage is charged until completion/cancellation rather than retaining
caller aliases. No second queue or shader parser was added.

Native29470 passes longREP beyond8192 packets, tiny-budget PC resumption,
immutable inputs, clipping yields, cancellation/error free-list ownership and
synchronous compatibility. Existing native pipeline39378 passes364 cases.
Actual COM bridge65892 passes with the deferred constructor. Async38349 uses
test-only privateVS2 admission to prove longREP yields through production
scheduling, pixel output, mutation-after-submit isolation and cancellation both
before construction and mid-setup. Compaction36033 passes25 cases after moving
deferred observations to readiness; it retains clipped-wire/point pixels,
freed-tail reuse, split-batch budget pressure and late-failure no-pixel checks.
The JS scheduler oracle and neutral command-stream tests also pass. Full-build,
worker/browser and broader adapter regressions remain required before this WIP
is treated as an integrated release checkpoint.

Follow-up acceptance: full5669 passes canonical1173043/compat1173511 bytes,
layout9c6027bce1d500a1,233 data segments without overlaps. Typed API94705 passes92;
production worker84731, real x86 guest-worker9384 and direct/worker occlusion32827
pass. Browser90559 independently compiles1173006 canonical bytes and passes
cooperative-main plus guest-main Worker scissor/targets/render-to-texture/Lock/
Present and native retirement. These close focused software integration gates,
not full-profile or gameplay acceptance. WebGL typed integration is still pending
its separate actual-GL result. The previously noted PS1.4 suite gap remains open.

### Typed GPU integration and private VS2 LOOP (2026-09-11, WIP)

The GPU adapter now validates all four typed banks before GPU or depth-binding
side effects, uploads signed integer vectors through the shared GPU uniform
cache, normalizes Boolean execution values, and resets absent uniforms to zero.
Component-specific integerUniformRanges are enforced before submission; shader
DEFI overrides API values. Actual WebGL1/2 test36956 passes five rendered states
per version and22 invalid-bank/count cases per version. Follow-up60915 adds
eight invalid LOOP parameter tuples per version and legal boundary tuples.
This closes the previously pending focused GPU typed-transport gate, not full
state-block, shader-profile or lifecycle acceptance.

Private LOOP27/ENDLOOP29 uses two canonical sources, aL and i0..15. The decoder
shares REP definite-initialization and backedge checks, with combined LOOP/REP
depth1 and static flow count16. Relative constant operands retain bit8 and add
bit10 for aL; immutable reader relativeAddressBanks metadata preserves this
distinction without inventing a guest-token bit. Public shader admission stays
unchanged. Decoder92735 passes LOOP115, REP148, IF151 and legacy IR/view;
matrix99910 passes165.

Native packets67/68 use paired body/end targets after definition hoisting.
The context retains aL at74092 and appends signed stride at74096 (total74100).
Entry captures count/start/stride once; ENDLOOP increments aL and decrements the
remaining count. The runtime rejects count/start outside0..255, stride outside
-128..127 or nonzero w with status-5, including invalid zero-count parameters.
Relative gathers check bounds before accessing constants and return zero out
of range, preserving the c127/c128 storage discontinuity. Every visited packet
retains existing budget/cancellation checks. Invalid paired targets and mutated
loop kinds fail explicitly.

Native16877 passes33 loop domain, stride, relative-access, malformed-flow,
parameter-snapshot, high-constant, budget and cancellation cases. Legacy45667
passes263 and pipeline98795 passes364 actual native software cases. Full79569
passes canonical1181589/compat1182058 bytes, layout9c6027bce1d500a1 and233
nonoverlapping data segments. Private VS2 VM98226 passes1662 after migrating
the expected context size to74100. Same-native-IR parity74947 passes174 WebGL1/2
frames against87 software rasters: six new LOOP witnesses cover both stride
directions, zero stride/count, c127/c128, nested IFs and late duplicate DEFI
overrides with exact positions and full-frame pixels. Calls and remaining mandatory
profile behavior, full frontend constant coverage, resources/lifecycle and
changing Black & White gameplay remain open; this is not public VS2 support.

Standalone GLSL56545 additionally passes18 real WebGL1/2 frames, domain rejection
and range metadata, including constant255 and both out-of-range directions.
Baseline IR77266 passes84 after migrating LOOP from unsupported-opcode to
truncated-operand expectations. Browser tests are explicitly E2E; the1076-test
tier/timeout/discovery checks pass. Mixed a0/aL reads in one instruction remain
rejected by the native single-constant-port rule; GLSL does not widen that rule.

### Private VS2 subroutines (2026-09-11, WIP)

CALL25/CALLNZ26/RET28/LABEL30 retain normalized IR ABI1. Labels use source
bank18 with the private canonical identity selector; CALLNZ uses b0..15 with
modifier0 or Boolean NOT13. The11-bit label bound is an encoding-bound private
policy, not a verified native maximum. Microsoft's
[CALL reference](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/call---vs)
allows only one call level in VS2.0 and forward targets; four levels belong to
VS3. Main and each routine have one terminal RET, with main RET optional only
when there are no subroutines. CALLNZ uses the conservative profile-table
three-slot cost despite its individual page saying one; CALL costs2, RET1,
LABEL0. Calls contribute to the static flow count16.

The decoder resolves labels with bounded source scans and replays a callee's
validation at each callsite using the actual incoming definitions. It does not
execute shaders, duplicate IR records, or charge lexical slots more than once.
CALL applies exact effects, including scratch clobbers; CALLNZ intersects the
taken and skipped definition states. LOOP entry-dependent reads/must-writes
survive calls, and a replay frame fence prevents a callee from closing caller
IF/loop blocks. Inherited aL requires every callsite inside LOOP; caller/callee
loop nesting cannot exceed one. Uncalled routines receive syntax validation;
their external-aL requirement is vacuous until called. Existing896-byte
validation scratch is reused and freed.

Native packets69/70/71/72 implement calls, conditional calls, return and labels.
Targets are linked after stable DEF hoisting. Return PC74100 and active flag74104
extend the context to74108 without moving older fields. Main RET ends execution;
callee RET resumes the saved PC, with target/kind/range checks. Integer Boolean
truth preserves nonzero values, including high-bit words. Budget and cancellation
remain checked at every visited packet, including suspended calls. Caller aL
and loop counters remain in their existing context fields.

Evidence: native RED79458 compile0 becomes81842 PASS37 for repeated calls,
conditional/NOT execution, one-packet budgets, cancellation, invalid call/return
targets, inherited or local loops and malformed routine structure. Adjacent
private VM22370 passes1662, legacy37480 passes263, LOOP26107 passes33 and native
software pipeline88898 passes364. Decoder80207 passes143, adjacent LOOP/REP/IF
passes115/148/151, legacy IR/view passes, and baseline58105 passes84 after its
CALL truncation expectation migration. Full79796 stopped at an unrelated
in-progress HookNode layout snapshot; its owner subsequently corrected that
snapshot. Full97842 then passes canonical1184406/compat1184875 bytes with
layout9c6027bce1d500a1 and233 nonoverlapping data segments. Actual WebGL call/parity
verification remains pending.
Public gates are unchanged; this is not full-profile or gameplay acceptance.

Admission audit after CALL: no remaining mandatory opcode omission was found,
but opcode presence is not complete VS2 semantics. The next gates include:

- Vector a0: current MOVA masks, relative selectors and initialization tracking
  are scalar-x-only. The [address-register page](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-vs-registers-address)
  and [VS2 feature comparison](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-vs-differences)
  specify four components, while MOVA's individual remarks say2_x. Resolve the
  discrepancy explicitly and implement component-wise dataflow before admission.
- Accepted-record mismatch: witness81837 compiles1100 repeated DEFs plus MOV
  into1101 native IR records (140960 bytes), but VM compilation rejects its
  arbitrary1024-record ceiling. This uses the existing private last-wins policy;
  it is not a Windows duplicate-definition oracle. Record count is not the256
  executable instruction-slot limit. Deduplicate or budget actual packet storage.
- End-to-end256 float constants: API/stateblocks/snapshots/software still stop
  at96. Raising that guard alone is unsafe: software constant upload is linear
  and would overwrite other register banks above c127; use the appended mapping.
- Advertised execution count is distinct from scheduling slices; define/test
  MaxVShaderInstructionsExecuted, including long LOOP+CALL, before exposing VS2.
- Conservative SINCOS direct/relative same-encoded-index coefficient rejection
  remains an acceptance-policy question. NEG-only ordinary VS2 source modifiers
  and current SGN scratch clobber handling match the inspected reference rules.

Record-budget follow-up: actual-native-IR test64151 reproduces executor rejection
at1101 records. The VM compiler, context constructor, executor and point-size
query now consistently use the shared4096-record ceiling, with checked packet
storage bounded to262160 bytes. This is a storage limit, not a raised profile
instruction-slot or uninterruptible execution budget. Test76083 passes1101 and
4096 records with last-wins DEF output,17-packet yields, high-index point-size
discovery and4097 rejection. Call85060 passes38 cases after also fixing the
point-size query: a CALL to label514 at an odd packet target must not masquerade
as the flat514 destination/write-mask words of a real oPts write. Typed/control
packets are now excluded from that query.

Native checkpoint verification: full32196 passes canonical1184420/compat1184889,
unchanged layout and233 nonoverlapping data segments. GLSL call source and its
browser/parity verification remain a separate pending integration; this native
checkpoint does not claim completed accelerated subroutines.

### Vector address register (2026-09-11)

Private VS2 now accepts MOVA masks1..15 and scalar-replicated relative a0
selectors x/y/z/w. This follows the address-register and VS2-differences pages;
the contradictory MOVA2_x remark remains documented above, not presented as a
resolved native-Windows oracle. The existing nearest-even tie policy remains.

Normalized source modifier bits11..12 carry the address component, independently
of the source-value swizzle. Bit8 still marks relative constants and bit10 aL;
aL rejects nonzero component metadata. The reader preserves an immutable
relativeAddressComponents array alongside relativeAddressBanks. Decoder a0
initialization is a four-bit mask: MOVA ORs its exact write mask, and IF/LOOP/
CALLNZ joins intersect component definitions. Unused-routine syntax validation
starts with mask15, while each real call is checked with its incoming mask.

The SIMD VM retains the existing register layout and context size. Its gather
chooses the selected a0 component per lane before bounds checking; MOVA preserves
unwritten components and uses existing vector rounding/masked stores. Initial
test74678 exposed only a negative-zero oracle mismatch; after correcting that
fixture,64647 proves missing vector compilation, then12078 passes37 mask,
component, rounding, high-constant and out-of-range cases. Decoder61921 passes342
plus CALL143/LOOP115/REP148/IF151. Baseline77737 passes84 after migrating full-mask
MOVA acceptance; native malformed-MOVA mask2 becomes genuinely invalid mask0.
Existing VM36145 passes1662, legacy41278 passes263, pipeline15229 passes364,
CALL52485 passes38 and LOOP14851 passes33. Full78042 passes1184557/1185026 bytes,
unchanged layout and233 nonoverlapping data segments.

The initial native-only WIP was held until GLSL consumed the component metadata;
the subsequent integration evidence below closes that specific gap. Public
profile gates stay closed.

### Full vertex float transport (2026-09-11)

The software descriptor and JS executor now accept256 vertex float4 constants;
pixel constants remain8. Native loading maps c0..127 to the existing VM bank
and c128..255 to its appended storage, avoiding the address/output banks that
a linear extension would overwrite. This changes transport, not public shader
profile admission. The device appends c96..255 at22684 (total25244); state blocks
append160 selection bytes at23068 and2560 value bytes at23228 (total25788).
Existing offsets remain unchanged. Set/Get validate the entire guest span before
copying or recording; Capture/Apply use selective masks and Reset zeros the new
storage. The host emits a detached1024-float raw-bit snapshot and charges the
additional2560 bytes before allocation.

Pipeline99048 first fails on the old96-constant descriptor limit;93041 then
passes370 cases, including actual pixels from c95/96/127/128/255 and rejection
of257 constants. Async72839 passes real private-VS2 deferred draws using the
full1024-float snapshot: mutation immediately after submission does not change
pixels, and retained bytes return to baseline after completion. Existing long
REP scheduling and cancellation checks also pass. No public caps were raised.
Resumable native setup59838 also passes; full shared-worktree build96381 passes
canonical1184581/compat1185050 bytes, unchanged layout hash and233 nonoverlapping
data segments. This is not an isolated clean-commit build or completed API path.
Subsequent API15257 passes52 float cases,92 typed cases and existing selective
state-block regressions. The async host protocol test passes all1024 raw words,
including NaN payloads, after both source banks are overwritten. Full12047 stops
on a concurrent non-D3D lib/host-window.js raw-region-literal gate; it is not a
successful integrated build. Test-tier and manifest checks pass1086 tests.

Additional software transport49279 passes375 pipeline cases. Whole-context
canaries for0/96/128/129/256 constants verify every broadcast lane and preserve
all nonconstant storage, including address/output, sampler and typed/control
banks. IEEE raw words include signed zero, infinities, subnormals and a NaN
payload; this transport test performs no shader arithmetic on those values.

### Long dynamic execution (2026-09-11, native evidence)

Record-budget test8194 passes an actual token-to-IR VS2 program with255 LOOP
iterations,14 calls per iteration, and200 additions per routine. All lanes and
components produce714000, with257-packet resumable slices and an execution
counter exceeding65535. A second run cancels explicitly after that threshold.
The existing1101/4096-record boundary checks remain green. This establishes
native dynamic execution independently of the scheduler budget; it does not
advertise MaxVShaderInstructionsExecuted or prove the pending WebGL equivalent.

### WebGL subroutines and vector address integration (2026-09-11)

GLSL emits each VS2 subroutine once, with shared register storage and a main
wrapper that publishes outputs after guest RET. CALLNZ preserves Boolean
nonzero/NOT semantics. Caller LOOP passes aL to the callee; a callee-local LOOP
is supported when it does not exceed the combined nesting limit. Address
initialization is tracked per component across branches, loops and call effects.
Every source operand keeps its own relative component, including matrix rows;
equal projected guest tokens do not collapse different address selectors.

The previously interrupted browser launch had no returned session. After an
escalated process check found no running CALL/parity test,94060 passes16 actual
WebGL1/2 subroutine frames. Pure vector lowering tests pass all15 masks, joins,
call effects and malformed metadata. Native61049 passes342 address-IR and37 VM
cases. Baseline70498 passes84 IR,1662 private VM and263 legacy VM cases.

Same-immutable-native-IR parity43383 passes274 complete WebGL1/2 frames versus
137 native position/raster executions. New cases cover every nonempty MOVA
mask, every selected component, caller/callee address writes and reads, Boolean
CALLNZ and NOT, selected matrix coefficient addressing, inherited aL and
callee-local LOOP. Existing arithmetic/matrix/IF/REP/LOOP cases remain green.
These are private VS2 profile tests, not native Windows conformance or public
VS2 admission; the documented numeric policies still apply.

Full shared-worktree build34288 passes canonical1185553/compat1186022 bytes,
layout9c6027bce1d500a1 and233 nonoverlapping segments. The earlier host-window
region gate is resolved by its owner. Exact-commit f09d1629 isolation separately
passed all seven constant/async/pipeline/record tests, but that historical
snapshot's full build failed the then-committed host-window gate; do not rewrite
that historical failure as a successful clean build.

### Typed state-block creation (2026-09-11)

CreateStateBlock now creates ALL, PIXELSTATE and VERTEXSTATE blocks using the
existing selective snapshot/transfer machinery. Creation captures immediately;
allocation remains unpublished until success. Shader/constants, declaration,
render/sampler/stage masks are selected by type. ALL additionally captures the
represented texture/stream/index bindings, matrices, material and rectangles.
VERTEX/ALL freeze the existing light index set so later Capture cannot add new
lights. Retained resources follow existing block ownership, not caller lifetime.

Membership follows Microsoft's detailed
[vertex](https://learn.microsoft.com/en-us/windows/win32/direct3d9/saving-vertex-states-with-a-stateblock),
[pixel](https://learn.microsoft.com/en-us/windows/win32/direct3d9/saving-pixel-states-with-a-stateblock)
and [all-state](https://learn.microsoft.com/en-us/windows/win32/direct3d9/saving-all-device-states-with-a-stateblock)
lists. The enum's overlap summary conflicts with those tables. The implementation
records the detailed-table policy explicitly: LOCALVIEWER/material sources are
shared; omitted FOGENABLE/NORMALIZENORMALS and TSS CONSTANT are currently ALL-only.
Those disputed choices still require a native reference and are not asserted as
conformance-complete. Absent clip-plane/palette/vertex-texture/stream-frequency
state remains a full-adapter delivery gap; storing/capturing a render state does
not imply that either renderer implements it. NPatch0 is an immutable invariant.

Actual-handler RED19501 traps before implementation; final8995 passes81 cases,
including inclusion and exclusion, high/typed constants, immediate capture,
rectangles, texture references, frozen light membership and invalid requests.
Four injected allocation failures (block and each of three copied light nodes)
leave no live test allocations, unchanged device state/reference count, null
output and a working retry. Existing selective blocks/float52/typed92 regressions
65905 pass. Structural gates34898 pass; no public profile caps changed.
Parent8170 repeats81 cases successfully. Shared-worktree full45196 passes
canonical1188129/compat1188598 bytes, unchanged layout and233 segments; it also
includes concurrent native clipper work and is not an isolated state-block build.

### User clip-plane state and software execution (2026-09-11)

Six native float4 equations now have real Set/Get, selective recording,
Capture/Apply, ALL-state capture and Reset coverage. The six equations begin at
device offset25244 without moving existing fields; later stream bindings bring
the current device to25596 bytes, while state blocks are25892 bytes. Equations
preserve raw bits; RS152 enables independently. Host snapshots reserve96 bytes
and copy all equations before guest mutation, tagging programmable clip space versus
fixed-function world space. No public clip-plane capability is raised.

The programmable software path geometrically clips against all six user planes
and existing frustum planes. Deferred setup owns its equations, preserves
original-edge/point provenance and cancels without publishing pixels. Active
planes use internal210-triangle batches to keep emitted U16 provenance indices
within13 bits; larger guest draws are split, not truncated or rejected by this
internal bound. Zero-mask draws retain their previous allocation layout.

Native43368 passes26 clipping cases and375 legacy pipeline cases; asynchronous
setup also passes. Adapter81149 and repeat99083 pass all six planes, a211-triangle
split, immutable inputs, malformed rejection, cancellation and allocation
retirement. Repeat99083 also passes56 actual clip-plane API/stateblock/reset
cases and geometry batching regressions. Agent54610 passes typed stateblocks81,
float52 and typed92; async protocol checks detached world/clip snapshots.
Shared build74886 passes1188272/1188741 bytes and233 nonoverlapping segments;
this is a shared-tree build, not an isolated commit verification.

Fixed-function world-space execution is still unimplemented and explicitly
rejected by software. Active WebGL planes currently reject before GPU access;
genuine clip-distance lowering is pending, not replaced by fragment discard.
These are partial adapter improvements, not complete clipping/profile parity.
