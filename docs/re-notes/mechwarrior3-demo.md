# MechWarrior 3 demo

## Binary and runtime layout

- App id: `mw3`
- EXE: `test/binaries/shareware/mw3/ex/Program_Files/mech3demo.exe`
- VC++ runtime: `test/binaries/shareware/mw3/ex/Shared_DLLs/MSVCP50.DLL`
- The EXE imports only two symbols from MSVCP50: the constructor and destructor
  for `std::_Lockit` (`??0_Lockit@std@@QAE@XZ` and
  `??1_Lockit@std@@QAE@XZ`).

## Browser `_Lockit` startup regression (2026-08-27)

The browser detected `msvcp50.dll` in the EXE import table but loaded only
`msvcrt.dll` and `mfc42.dll`, then trapped at EIP `0x0049daf0` on the unresolved
`std::_Lockit` constructor. The CLI did not reproduce the failure because its
DLL search includes the sibling `../Shared_DLLs` directory. A browser has no
directory search and can fetch an app-local DLL only when the app manifest
provides its URL.

The `mw3` manifest therefore carries the authentic `MSVCP50.DLL` as an explicit
`dlls` seed. This is deliberately app-local rather than a generic no-op API
stub: MSVCP50's real `DllMain`, imports, and lock implementation run, and no
other app opts into the runtime.

Focused verification:

```sh
node test/test-debug-dropdown-manifests.js
/opt/homebrew/bin/timeout -s KILL 90 node test/run.js --app=mw3 \
  --max-batches=3 --batch-size=100000 --quiet-api --quiet-blocks \
  --no-close --no-build
```

The boot run loads MSVCP50 first, patches the EXE's `MSVCP50.dll` imports to DLL
slot 0, completes all three runtime `DllMain` calls, loads `mech3msg.dll`, and
creates/shows the `MW3 Demo v0.183 build 1` window without an unimplemented API
trap.

## Browser resources and menu text

The demo's button captions are resources in `Mech3Msg.dll`, not literals in
the EXE. The browser manifest mounts that DLL explicitly so labels resolve to
the shipped Campaign, Training, Instant Action, Multi Player, Options, and Quit
strings.

MW3 measures those captions on a compatible memory DC before selecting a DIB.
`DrawText(DT_CALCRECT)` previously rejected that DC because it had no drawable
surface, leaving every measured `RECT` at zero and producing an empty caption
atlas. The GDI text path now permits font-only DC state for `DT_CALCRECT` while
ordinary drawing still requires a bitmap. `test/test-wat-gdi-calcrect-memory-dc.js`
covers both halves.

## Opt-in RGB565 alpha row

The authentic loop at EIP `0x00528064..0x00528111` composites a bounded RGB565
row with four source-alpha cases. H436 samples its structural head/tail and
hashes the complete 173-byte body, derives its pixel count from the guest
frame's `[ebp-0x18]` bound, and publishes x86 state at each safety chunk. Its
emitted back/fall operands come from the matched location rather than those
demo VAs, so an identical loop in a differently linked build is recognized.
The `mw3` manifest alone enables the existing copy-superop gate; default
behavior for every other app is unchanged. `test/test-mw3-rgb565-alpha-run.js`
compares ordinary and fused execution over all alpha arms, bounds, flags,
registers, a relocated authentic body, and a one-byte near miss.

Threads mode creates one WebAssembly instance per guest thread over shared
memory. The gate was originally a mutable WebAssembly global, so only the main
instance observed `copySuperops: true`; a worker decoding the compositor kept
the default-off path. `LOOP_PROCESS_STATE` now stores that process opt-in in an
atomic shared-memory word. The same regression instantiates two decoders over
one shared memory and proves opt-in and rollback are visible in both directions.

## Gameplay input

Pilot entry calls the five-argument USER32 `ToAscii`. The handler delegates to
the existing `ToAsciiEx` keyboard-state implementation and adjusts the stack
for the shorter signature. `test/test-to-ascii.js` checks lower/uppercase
translation and the exact stdcall ESP delta. With that API present, a pilot can
be created and the Instant Action flow remains live instead of trapping on the
first typed character.

## Indexed Direct3D texture loss (2026-08-27)

MW3 uses Direct3D 3's fixed-function immediate mode; programmable vertex and
pixel shaders do not exist in this API generation. The broken gameplay frame
showed valid projected/cullable world geometry and the intact 2D cockpit HUD,
but the world triangles carried only flat diffuse colours.

The software D3DIM bridge had two terminal triangle paths. `DrawPrimitive`
resolved stage 0 and sampled the bound DirectDraw surface, while
`DrawIndexedPrimitive` transformed the same TL vertex shape and then called
the flat rasterizer unconditionally. The latter bypass discarded `tu/tv` and
the live texture binding without failing the draw, which explains the very
specific geometry-present/textures-absent result.

Indexed triangles now enter the shared cull-and-maybe-texture helper used by
unindexed triangles. This is a fixed-function software-rasterizer correction;
it does not add shaders or change DirectDraw presentation.

That first regression was incomplete: it bound the DirectDraw surface through
the newer `IDirect3DDevice3::SetTexture` entry point. MW3's gameplay path uses
the legacy Direct3D sequence instead:

1. `IDirect3DTexture2::GetHandle` returns the surface's texture handle.
2. `IDirect3DDevice3::SetRenderState(D3DRENDERSTATE_TEXTUREHANDLE, handle)`
   makes that handle the active stage-0 texture.
3. `DrawIndexedPrimitive` submits the terrain.

Device2 and Device7 already routed `SetRenderState` through the common helper
that performs step 2. Device3 had a private copy which saved the render-state
dword but did not update the stage-0 binding. Its indexed draw therefore still
fell back to flat diffuse polygons in real MW3 even while the original
`SetTexture`-based test passed. Device3 now uses the same helper.

The textured rasterizer also used to discard the diffuse colour after lighting
and copy the sampled texel directly. It now Gouraud-interpolates diffuse RGB and
applies fixed-function stage-0 modulation, so lighting affects textured terrain
instead of being visible only on the flat fallback. The focused
`test/test-d3dim-indexed-texture.js` now exercises the authentic Texture2
handle → Device3 render state → indexed draw chain and verifies a half-intensity
diffuse colour modulates a four-colour RGB565 texture. The old Device3 handler
produces only white/empty target pixels; a raw-texture-only implementation also
fails the expected modulated-colour assertion.

## Operation-map false stall report (2026-08-28)

The debug popup formerly printed `Yield 9 = blocked EnterCriticalSection` as an
unconditional heading. On MW3's operation map that looked like a diagnosis even
though the row below it said `yield=0 (running)`. Live real-Worker sampling
confirmed no lock problem: main T1 had `csWaits=0`, `csWaitAddr=0`, and advanced
its slice counter while idling in the normal `PeekMessageA` pump at
`0x00559d62`; transition T2 advanced through distinct EIPs and exited cleanly.
The same isolated Threads route progressed from the map to the textured Instant
Action configuration screen.

The map is also an interactive campaign screen: its circular `Start` marker is
near the lower-left, and the separate debug popup can cover it. The popup now
prints an actual aggregate status such as `Status: no blocked guest threads` and
keeps yield 9 only as an explicitly labelled legend.

## Deterministic gameplay capture and fixed-function blending (2026-08-28)

`test/test-mw3-gameplay.js` drives the complete Instant Action route with
relative mouse input, creates a pilot, crosses the operation map, deploys, and
captures a 640x480 cockpit frame. It runs both the ordinary scheduler and the
real guest-worker Threads path. The local demo executable is pinned by SHA-256,
and a missing demo is reported as a skip rather than silently testing another
binary.

The catastrophic flat-frame repro measured only 135 exact colours, 89
four-bit-per-channel colours, and five colours in the terrain sample. The final
explicit-primary capture measures 2,053, 405, and 159 respectively, with separate minimums
for the orange lit sky, dark textured cockpit, and readable green HUD. This
makes the test reject a reachable-but-untextured game instead of treating any
gameplay-shaped frame as success.

The trace also showed textured draws using the legacy framebuffer blend state:
`ZERO/SRCCOLOR` for modulation and `SRCALPHA/INVSRCALPHA` for fades. The
software textured span now preserves interpolated vertex alpha, reads the
destination pixel, and applies those fixed-function blend factors before
writing RGB565. `test/test-d3dim-indexed-texture.js` pins the destination
modulation case independently of the proprietary demo.

Run the acceptance directly with:

```sh
node test/test-mw3-gameplay.js
```

The resulting CLI evidence is written to
`build/mw3-gameplay/no-threads.png` and
`build/mw3-gameplay/threads.png`. Both modes must produce the same measured
textured/lit scene (minor scheduler-dependent HUD pixels may differ). The gate separately rejects cyan,
magenta, and electric-blue texels characteristic of a pixel-format regression.
It explicitly captures DirectDraw slot 5, the primary/front surface; an
arbitrary snapshot of slot 6 can catch the back buffer midway through a frame
and is not valid evidence of a presentation defect.

## 16-bit texture format corruption and raster cost (2026-08-28)

The remaining cyan/green/purple scenery was not missing texture data. A live
surface census found common 16-bit words such as `0xF678`, `0xF334`, `0x0877`,
and `0x2877`. They are coherent grey texels in ARGB4444, but the sampler treated
every 16-bit DirectDraw surface as RGB565. The same defect affected
`Texture::Load`: equal bit counts triggered a raw copy even when source and
destination channel masks differed. `Lock`, `GetPixelFormat`, and
`GetSurfaceDesc` then compounded the error by reporting RGB565 regardless of
the format requested at creation.

DirectDraw now retains a normalized format kind per surface and reports the
original RGB/alpha masks. Sampling and `Texture::Load` support RGB565,
XRGB1555, ARGB1555, ARGB4444, XRGB8888, and ARGB8888, including alpha in the
fixed-function blend path. The focused indexed-texture regression proves an
opaque ARGB4444 `0xF678` texel renders grey and transparent `0x0877` preserves
the destination. In both scheduler modes the gameplay capture now contains
zero cyan and zero magenta artifact pixels.

The software rasterizer remains the valid acceleration path for D3D3: it runs
native WebAssembly against lockable DirectDraw surfaces and avoids emulating an
x86 pixel loop. The hot span used to reload immutable texture metadata for
every pixel and execute seven integer divisions plus a floating division per
pixel. Metadata is now hoisted per span, division by 255 uses an exact bounded
identity, the interpolation reciprocal is computed once, and MW3's two observed
blend pairs have direct paths. The complete no-threads menu-to-gameplay CLI run
dropped from 92.3 seconds to 60.3 seconds while retaining the accepted frame;
threads mode completes in 75.9 seconds and produces the identical PNG.

This is not a claim that all advertised legacy Direct3D capabilities are
implemented. `fill_primcaps` still reports broad comparison, filtering,
addressing, shading, and blend masks while the rasterizer implements a smaller
fixed-function subset, and several Device methods remain compatibility stubs.
That contradicts the truthful-semantics guidance in `fable-review.md`; future
work should narrow caps alongside implementing the corresponding render states.
For later Direct3D resource models where render targets are not CPU-lockable,
the correct extension is host-GPU resource/shader translation rather than
pretending those surfaces support the D3D3 memory contract.

## Attached depth and multi-texture FVF stride (2026-08-29)

The later cockpit repro had two independent correctness defects. First, every
triangle path was effectively submission ordered. MW3 creates a 16-bit
`DDSCAPS_ZBUFFER`, attaches it to the render target with
`AddAttachedSurface`, clears it to zero with `DDBLT_DEPTHFILL`, and selects
`D3DCMP_GREATEREQUAL`. DirectDraw discarded both creation caps and the
attachment relationship, while D3DIM used a private plane the application
could neither clear nor lock. Per-surface metadata now retains
`{creation caps,parent slot+1}`; D3DIM locates the real attached depth surface,
compares and writes its native 16/32-bit values, and honors `ZENABLE`,
`ZWRITEENABLE`, and all eight `ZFUNC` values. A full-surface zero Blt uses
WebAssembly bulk fill instead of 307,200 scalar stores.

Second, the remaining screen-sized diagonal sheet was not a matrix or Z
precision error. Live `IDirect3DDevice3::DrawPrimitive` calls used
`FVF=0x3c4`: `XYZRHW | DIFFUSE | SPECULAR | TEX3`. That descriptor has a
48-byte source stride. The Device3 handler recognized `XYZRHW` but passed the
source to the canonical 32-byte `D3DTLVERTEX` reader without repacking it.
Vertex 0 happened to be valid; subsequent vertices began in texture-coordinate
data and produced infinities and enormous coordinates. Device3 now shares the
FVF packer already used by Device7, preserving the first texture set while
advancing across all three sets. The focused indexed-texture regression uses
the exact `0x3c4` layout and would fail under the former 32-byte stepping.

The same regression attaches a real 16-bit Z surface and draws overlapping red
and green triangles. It proves a lower reversed-Z triangle is rejected, a
higher one passes, and the application-visible depth pixels are updated. The
deterministic primary capture now has coherent road, hills, cockpit, sky, and
HUD geometry in both cooperative and real-Worker modes. The later
perspective/sampler correction below supersedes the digest recorded by this
intermediate fix.

The dark foreground is consistent with the submitted fixed-function state,
not evidence of a missing shader. MW3 selects stage-0
`MODULATE(TEXTURE,DIFFUSE)`, then uses `ZERO/SRCCOLOR` framebuffer passes for
light maps. Preserving those operations is required; replacing them with raw
texture copies makes the scene brighter but semantically wrong.

## Corrected renderer profile and SIMD assessment (2026-08-29)

On the same no-threads 1,000-batch route, the pre-fix CPU profile sampled
82.35 seconds: 64.10 seconds in WebAssembly, with textured triangle/span work
at 15.13 seconds (18.4% of total). Those numbers mostly measured pathological
overdraw from malformed 48-byte vertices, not the cost of the intended scene.
After FVF repacking and the depth-clear fast path, the profile sampled 33.65
seconds: 26.15 seconds in WebAssembly, while
`viewport_draw_textured_span` fell to 0.23 seconds (0.7%). The dominant costs
are now the x86 engine's `$next`, register accessors, and branch machinery;
canvas `drawImage`/`putImageData` are the largest host-side costs.

For that corrected no-threads profile, SIMD was therefore not the next useful
MW3 renderer optimization. Texture
addresses differ per pixel and WebAssembly SIMD has no gather operation, so a
four-pixel sampler would still require scalar loads before any vector math.
Potential later SIMD candidates are four-wide depth comparisons, post-gather
modulation/blending, and RGB565 packing. They should be attempted only against
a representative profile; state-specialized scalar paths, incremental
interpolation, and bulk clears remain better first choices. This follows the
`fable-review.md` boundary: fixed-function logic and resource truth stay in
WAT, while JS remains a presentation/raster host rather than a second D3D
implementation.

## Perspective, UV-set, and sampler-state parity (2026-08-29)

The stride correction above was necessary but not sufficient: its statement
that the first texture set is always preserved was wrong for MW3. A live
Device3 state trace showed stage 0 changing `D3DTSS_TEXCOORDINDEX` among 0, 1,
and 2 while submitting `FVF=0x3c4`. The generic packer advanced over all three
sets but copied only set 0 into the canonical TL vertex, so detail and light-map
passes sampled their base-texture UVs. Device state also discarded every stage
state above type 7; MW3's `ADDRESSU/V` wrap/clamp and point/linear filter
changes therefore never reached the sampler.

The same capture found visible-triangle RHW values from roughly 0.00069 to
0.0107, over a 15x range. The scan converter linearly interpolated raw U/V,
which is only valid when RHW is constant. It now carries `u*rhw`, `v*rhw`, and
`rhw` across edges and spans, then divides at the pixel. Near-plane clipping
also interpolates colour, specular, and UV attributes instead of copying the
first endpoint. Stage 0 stores and consumes coordinate selection, wrap/mirror/
clamp addressing, and point/linear filtering. `COLOROP`/`ALPHAOP` now honor the
observed `SELECTARG1` and `MODULATE` transitions rather than always modulating.

`test/test-d3dim-indexed-texture.js` isolates each rule with the exact TEX3 FVF:
set 1 selects blue rather than UV0 red, set 2 at V=1 clamps to yellow rather
than wrapping to green, a centre linear sample averages all four texels, and a
high-RHW triangle pixel stays red where affine interpolation selects green. It
retains the ARGB4444, framebuffer-blend, alpha, and attached reversed-Z checks.

The accepted 640x480 CLI gameplay captures now comfortably clear the texture
detail gates with zero cyan/magenta corruption; representative late Worker
captures measured 2,310–2,331 exact colours and 139–141 terrain bins. Their
sky, terrain, cockpit, and HUD are visually coherent.
Worker timing can leave the operation-map button inactive at an early scripted
click, so the acceptance route no longer guesses fixed transition batches. It
waits for the operation map's measured near-black-pixel range before clicking,
then waits for the cockpit's distinct >100k-dark-pixel range before capture.

The then-labelled batches-840..1080 CPU-profile window fell from 12.27 seconds
sampled before these corrections to 8.40 seconds after them (31.6%). The current
profile spends 69.3% in WebAssembly; the largest renderer function is the
textured span at 567 ms (6.8% total), followed by texture decode (290 ms),
colour interpolation (288 ms), FVF packing (201 ms), texel fetch (197 ms), and
addressing (142 ms). Presentation `drawImage`/`putImageData` totals about
0.93 seconds, while API-name logging alone costs 0.58 seconds even in the CLI;
the browser Runtime log should remain off when measuring gameplay FPS.

SIMD does help the one contiguous operation the profile identified: MW3's hot
0x3c4 pack now copies the 24-byte position/colour/specular header with one
`v128` load/store plus one `i64` load/store, then copies the selected UV pair.
It does not solve the dominant sampler because WebAssembly still has no gather;
four-way filtering requires four scalar, format-aware texel fetches. Further
SIMD work belongs behind a new profile rather than changing fixed-function
results for a speculative vector fast path.

## Relative mouse clip edge and current cost split (2026-08-29)

MW3 hides the Win32 cursor and consumes relative DirectInput motion for its
software cursor. Pointer-lock events were first applied to the emulator's
virtual Win32 cursor and clipped to `ClipCursor`; the DirectInput delta was then
derived from that already-clipped position. Once the virtual cursor touched an
edge, motion farther toward the edge became zero even though a physical mouse
still reported movement. This is incorrect for any game which applies its own
sensitivity or keeps an independently bounded software cursor.

Relative input now converts the raw browser delta through the active native
presentation scale, retains fractional native movement between events, and
feeds that unbounded value to DirectInput. Ordinary `WM_MOUSEMOVE` and the
emulator's visible cursor remain clipped as Win32 requires. The focused
`test/test-relative-mouse-clip-edge.js` covers both the logical 2x transform and
the separate physical presentation viewport used by sharp/FSR scaling. A CLI
MW3 capture also clarifies that the yellow cursor ring's centre stopping about
nine pixels below the top is game behavior: MW3 keeps the complete roughly
18-pixel sprite visible. It is not evidence that raw DirectInput motion stopped.

The mixed deploy/early-game profile above remains useful for locating renderer
cost, but the measurements below supersede its description as representative
steady gameplay: the deterministic cockpit predicate did not match until batch
891. WebAssembly accounts for 69.3% of that sampled 8.40-second window. The six
largest named software-D3D functions total about 1.69 seconds (20.1% of the
whole window); presentation is about 0.93 seconds (11.1%), and API-name logging
is 0.58 seconds (6.9%). These categories are not a complete partition and the
sample crosses deployment, so they are ceilings and ordering evidence, not a
steady-state FPS attribution. Keep Runtime log off for play and measurement.
The existing SIMD header copy addresses the hot contiguous FVF operation; the
format-aware sampler remains gather-bound, so more SIMD is not an
evidence-backed next optimization.

## Measured x86 loops and render-Worker feasibility (2026-08-29)

### Measurement boundary and authentic CRT execution

The first hot-block pass armed at batch 840 because the cockpit had appeared in
an earlier fixed-timing run. The state-driven route used here did not satisfy
the cockpit's measured dark-pixel predicate until batch 891. Consequently the
840..1080 result is a deploy/load plus early-game sample, not a steady-gameplay
sample. Wall-clock time was also unusable while the development host was
saturated, so the results below use deterministic guest batches, basic-block
entries, API-call deltas, and DirectDraw `Flip` counts only.

Wine-Assembly is executing the shipped x86 `MSVCRT.DLL`, not a WAT replacement.
It is loaded at `0x01808000` from original base `0x78000000`; exported `free` is
`0x7800138a` and `malloc` is `0x78001498`. In the mixed 840..1080 window, exactly
48,000,000 x86 basic-block entries were recorded. Six MSVCRT blocks accounted
for 47,997,521 (99.995%):

| Runtime EIP | Original EIP | Entries | Share | Static role |
|---|---:|---:|---:|---|
| `0x018093fb` | `0x780013fb` | 14,282,161 | 29.75% | compare freed pointer with small-block descriptor start |
| `0x0180943d` | `0x7800143d` | 14,282,161 | 29.75% | advance the circular descriptor list |
| `0x01809400` | `0x78001400` | 14,282,159 | 29.75% | compare freed pointer with descriptor end |
| `0x018092af` | `0x780012af` | 4,120,831 | 8.59% | scan zero bytes in a small-block page's run map |
| `0x018091d2` | `0x780011d2` | 515,105 | 1.07% | test a small-block page-range descriptor |
| `0x0180920c` | `0x7800120c` | 515,104 | 1.07% | advance descriptor and corresponding 4 KiB page |

This is a distribution of emulated x86 block entries, not a distribution of
wall time. Native-Wasm D3DIM raster functions run synchronously inside an API
handler and do not appear as x86 blocks, so “99.995% of x86 blocks” must not be
read as “99.995% of total CPU.”

The `free` ownership walk is not a corrupt circular list. Live memory showed the
relocated sentinel at `0x01845178`, its next descriptor at `0x041d863c`, and a
second descriptor at `0x0440b804`; successive frees of `0x4f591770` and
`0x4f591760` reached an owner and returned. A shadow call stack resolved the
path as MSVCRT helper `0x780013f2` -> `free` -> EXE `0x00483110` (a small
`if (*p) free(*p)` destructor) -> EXE `0x004b98b0`, reached from the game's
`0x00559dxx` update loop. The high count is many temporary-object frees, not one
infinite list traversal.

The later byte-run scan initially looked more concerning, but a memory trace
disproved that interpretation. A histogram armed only after the first accepted
cockpit frame stopped at `0x780012af` when the diagnostic same-EIP watchdog saw
eleven full batches end there. It had recorded 2,369,615 entries at that byte
scan (69.67% of recorded blocks), plus 515,105 and 515,104 at the two page-range
blocks. Moving the arm point to batch 930 reproduced the distribution. Those
are aggregate *block entries across many allocations*, however, not one scan
advancing through millions of bytes. The watchdog compared only EIP across
batch boundaries and ignored the changing `EAX`/`ECX` loop progress.

At the first traced post-cockpit entry (batch 904), the authentic CRT state was
coherent: page base `EDI=0x4f586000`, run-map cursor `ESI=0x4f58604d`, scan
cursor `EAX=0x4f58604e`, requested run `EDX=0x1e`, and the next real nonzero
run marker (`0xff`) was at `0x4f58607b`. This individual search crossed only 46
zero bytes, remained inside the page's 248-byte run map, and then took the
normal successor. `EBP=0x4f58606b` was `ESI+EDX`, the prospective requested-run
end used by the outer algorithm, not the end of mapped metadata. There is no
evidence here of an x86 semantic error, overwritten heap metadata, a missing
sentinel, or an infinite CRT loop. The earlier “millions of zero bytes” claim
was a profiling-unit error and must not be used as a correctness diagnosis.

There was a separate real loader bug. `initMsvcrtGlobals` intended to disable
the authentic small-block heap, but recognized only a private implementation
starting `55 8b ec a1` and then wrote a guessed `__active_heap` address. MW3's
Win98 `MSVCRT.DLL` exports `_set_sbh_threshold` at `0x78018512` with body
`8b 44 24 04 ... a3 68 d1 03 78`; its live threshold was `0x1e0` at runtime
address `0x01845168`. The private byte pattern therefore silently matched
nothing. The loader now resolves and calls the authentic public export as
`_set_sbh_threshold(0)` after DLL initialization. This is the CRT-supported
operation: future small allocations use its HeapAlloc path, while any SBH pages
created during `DllMain` remain registered so later `free` calls can still
recognize their owners.

With that call active, the same 892..950 post-cockpit histogram contains none
of `0x780012af`, `0x780011d2`, or `0x7800120c`; its leading handlers are the
game's FPU-heavy transform work and its leading MSVCRT block is only 2.63%.
Both cooperative and real-Worker routes still match the textured-cockpit visual
predicate (133,341 dark pixels). A same-host fixed-950-batch A/B took about
59.5 seconds with the ineffective patch and 57.0 seconds through the public
threshold call, but this approximately 4% wall difference is directional only:
fixed batches do not represent fixed work and host load is uncontrolled. At
batch 950 the new path had issued 279,589 `HeapAlloc` and 44,131 `HeapFree`
calls, so eliminating the emulated SBH search exposes API/thunk and WAT-native
heap cost rather than making allocation free. Further allocator optimization
must profile that path directly; SIMD for `0x780012af` is no longer justified
as an MW3 correctness fix.

A wholesale WAT-native `malloc/free` interposition is not a safe shortcut.
MSVCRT, MSVCP50, MFC42, and the EXE exchange allocator-owned pointers, while
direct calls inside each authentic DLL bypass the EXE import table. Replacing
only imported `malloc/free` would create two incompatible heaps. Replacing the
complete allocation family would also need `calloc`, `realloc`, C++ new/delete,
small-block ownership, locking, and every internal direct-call edge. Calling
the CRT's own threshold API is different: authentic MSVCRT still owns the
allocation contract and deliberately selects its existing HeapAlloc fallback.
If its SBH is ever retained for performance, an exact decode-time fold of a
verified CRT loop remains lower risk than interposition: it continues to read
and update MSVCRT's structures and resumes at the authentic x86 successor with
identical registers and flags. The existing `$fast_msvc_sbh_scan` is precedent,
not a solution to these addresses: it recognizes one exact descriptor/range
shape and does not replace CRT allocation generally.

### Command mix after the first accepted cockpit frame

These command counts were collected before the public threshold-call fix, while
the loader's ineffective private-pattern patch still left SBH enabled. They
remain useful as a per-present render-command mix; fixed-batch totals before and
after changing allocator code must not be compared as equal gameplay work.

Three otherwise identical no-threads runs ended at batches 830, 892, and 950.
The cockpit predicate matched at batch 891. Subtracting the batch-892 census
from batch 950 isolates 58 batches in which the guest executed 20
`IDirectDrawSurface::Flip` calls. Counts are deterministic; no wall-clock FPS is
inferred.

| API | At 830 | At 892 | At 950 | Post-cockpit delta | Per `Flip` | Worker treatment |
|---|---:|---:|---:|---:|---:|---|
| `Device3::DrawPrimitive` | 20 | 1,037 | 16,041 | 15,004 | 750.20 | queue; own packed vertex payload |
| `Device3::SetTexture` | 20 | 1,037 | 16,041 | 15,004 | 750.20 | queue/coalesce surface id + generation |
| `SetTextureStageState` | 0 | 40 | 833 | 793 | 39.65 | queue/coalesce |
| `SetRenderState` | 131 | 194 | 782 | 588 | 29.40 | queue/coalesce |
| `BeginScene` / `EndScene` | 20 / 20 | 30 / 30 | 147 / 146 | 117 / 116 | 5.85 / 5.80 | ordered markers; no fence by themselves |
| Surface `Lock` / `Unlock` | 563 / 562 | 691 / 691 | 762 / 762 | 71 / 71 | 3.55 pairs | fence only conflicting surface users |
| Surface `Blt` | 489 | 492 | 517 | 25 | 1.25 | queue with read/write dependencies |
| Surface `Flip` | 494 | 503 | 523 | 20 | 1.00 | frame/presentation fence |
| `Texture2::Load` / `Release` | 24 / 24 | 141 / 141 | 168 / 168 | 27 / 27 | 1.35 / 1.35 | ordered copy; deferred destruction |

The state/draw rows contain 31,622 queueable calls, about 1,581 per `Flip`.
Calling `postMessage` or performing an RPC for each one would be worse than the
current direct WAT calls. A frame-sized shared command ring is plausible: it
amortizes wakeup overhead and has about 750 draws over which the game can build
the remainder of a frame while another core rasterizes earlier draws. The
unknown variable is vertex payload volume; `DrawPrimitive` supplies a borrowed
guest pointer today, so a prototype must measure packed bytes as well as calls.

### What Threads mode already does

In browser Threads mode, slot 0 (the guest main thread) already runs in a Web
Worker. D3DIM is WAT called synchronously by that instance, so software
rasterization is already off the browser UI thread. The browser thread serves
imports and composites completed surfaces. A dedicated render Worker would not
fix UI-thread blocking; its purpose would be to overlap the main guest's x86
simulation/command generation with native-Wasm raster work.

The existing renderer cannot simply be called concurrently from a second
instance. Render targets, depth buffers, textures, DX object records, and most
device state are in shared WebAssembly memory, which is promising. However,
lighting caches and several D3DIM control/debug values are mutable
per-instance globals, scratch vertices live inside the device state block, and
draw handlers currently consume guest pointers then free temporary packed FVF
buffers before returning. WebAssembly instances are not re-entrant across
Workers. The render side therefore needs an explicit command ABI rather than a
second caller entering the guest instance.

### Feasible command-stream design

Use one SharedArrayBuffer-backed single-producer/single-consumer ring per D3D
device. The guest Worker is the producer; a dedicated render Worker owns a
renderer-only instance over the same shared memory. Each packet has a sequence,
opcode, payload length, referenced surface slot plus generation, and read/write
surface sets. Publish the packet length/sequence with an atomic release store;
the consumer advances a completed sequence and wakes any targeted fence.

For MW3's measured path:

1. `SetTexture`, render state, texture-stage state, and scene markers are tiny
   ordered packets. The encoder may coalesce states that are overwritten before
   a draw, but the replay contract should first be proved without coalescing.
2. `DrawPrimitive` packs the selected FVF once directly into command-owned
   canonical vertices. The current Device3 path allocates a temporary packed
   buffer, draws from it synchronously, then frees it; enqueueing the borrowed
   pointer would be a use-after-free. Direct packing into ring payload avoids a
   second copy and gives the consumer immutable input.
3. Textures, render targets, and attached depth buffers remain in shared
   DirectDraw surface memory. A draw references stable slot/generation/CPU-epoch
   values rather than copying whole textures.
4. Track `lastReadSequence` and `lastWriteSequence` per surface. `Lock` waits
   only when CPU access conflicts with queued reads/writes of that surface;
   `Unlock` publishes a new CPU epoch used by later commands. `Blt` and
   `Texture::Load` carry source-read and destination-write dependencies.
5. `Flip` queues presentation after all writes to its front/back pair and waits
   for that sequence before returning/publishing. This is one mandatory fence
   per measured frame. `GetDC`, read locks, status/readback calls, and any API
   returning rendered pixels are also barriers.
6. A COM `Release` that reaches zero tombstones the slot/generation immediately
   but defers reuse and backing-memory reclamation until its last referenced
   sequence completes. This usually needs no producer stall.

The 71 measured lock pairs are an upper bound of 3.55 possible surface fences
per frame, not 3.55 guaranteed global stalls: locks of surfaces absent from the
queued dependency set proceed immediately. Instrument the surface ids before
predicting overlap. Conversely, `Flip` limits cross-frame queue depth, so the
expected gain comes from overlap within a frame, not from rendering arbitrarily
far ahead.

This is technically feasible but medium/high complexity. It does not reduce
total raster CPU and can regress on a two-core/mobile host. The earlier mixed
profile's 20.1% named-D3D share gives only a rough perfect-offload Amdahl ceiling
of `1 / (1 - 0.201) = 1.25x`; it is not a prediction because that sample crosses
deployment and excludes the newly exposed CRT pathology. Fix or explain the
allocator scan, then take a wall profile over verified moving frames before
committing to the Worker.

Implementation should be staged behind an opt-in:

1. Define packets and replay them synchronously on the current guest Worker.
   At every `Flip`, compare render-target/depth/texture state and the captured
   primary image with the direct-call path in both scheduler modes.
2. Add generation/lifetime and per-surface dependency tests for
   Draw -> Lock, Unlock -> Draw, Blt/Load ordering, attached depth, and Release
   before replay. No API may report successful completion while guest-visible
   output is still observably stale; this is the truthful-semantics boundary
   from `fable-review.md`.
3. Move the already-proven replay consumer to a dedicated Worker and batch one
   wakeup per filled chunk/frame, using the existing OpenGL command stream as a
   transport precedent rather than sharing its GL-specific command format.
4. Re-run the command/byte/barrier census and matched moving-frame wall profile.
   Keep the Worker only if overlap exceeds queue copies, atomics, and lost-core
   cost without changing the gameplay image.

### Opt-in render-Worker prototype (2026-08-30)

The first implementation is deliberately narrower than the final design. With
browser Threads enabled, `?d3d-worker` gives the guest-main Worker a three-slot,
2 MiB-per-slot shared batch ring and starts a renderer-only Wasm instance over
the process memory. Device3 `DrawPrimitive` copies its canonical 32-byte
vertices and a 4 KiB device-state snapshot into the command record before the
handler frees its temporary FVF buffer. The consumer replays FIFO into shared
render-target/depth/texture surfaces. `Lock`, `Blt`/`BltFast`, `Flip`, clear,
texture load/release, palette/color-key changes, and device/surface lifetime are
global fences; unsupported draw families fence and use the synchronous path.
Cooperative and non-opted-in Workers return “not queued” from the private GPU
opcode and therefore execute the unchanged renderer.

This version proves ownership, sequencing, and the second-instance mechanism;
it does not yet implement surface generations, per-surface dependency fences,
or direct-to-ring FVF packing. A normal Threads smoke accepted 159 real MW3
draws with zero fallbacks and zero Worker errors. It also caught and fixed a
ring bug where an idle fence could republish the stale bytes of a rotated slot:
after the fix, 159 accepted draws produced exactly 159 submissions. The fully
textured menu is browser-visible, but moving-cockpit image parity and FPS A/B
remain required before this can be enabled by default. Menu traffic fences
almost every draw; only gameplay's measured ~750 draws/Flip can show whether
in-frame batching pays for the 4 KiB state copies.

### Gameplay A/B, command cost, and raster-worker profile (2026-08-30)

An automated real-Chrome route now selects or creates the pilot, enters instant
action, waits for the operation map, moves MW3's own software cursor onto the
bottom-right deployment icon, and samples ten seconds only after the cockpit
appears. The matched initial run measured 4.105 guest fps synchronously and
4.322 with `?d3d-worker`, a 5.3% improvement. This is evidence that producer
and consumer overlap, not a stable end-user FPS forecast: later runs on the
shared development host ranged from 2.17 to 11.84 fps as load changed. Per the
browser profiling rule in `CLAUDE.md`, samples taken with load average above 4
are load-invalid.

The two gameplay captures were visually equivalent and both retained the
textured cockpit, sky, terrain, HUD, and mech preview. Their coarse image
metrics differed by only 0.5--1.3% (2,322 versus 2,310 exact colours; 226,892
versus 229,844 orange pixels; 309,419 versus 308,306 dark pixels; 6,051 versus
5,992 green pixels), consistent with rain, timer, and camera motion. The later
post-optimization capture also has no earlier green/purple texture noise.

The command counters explain what the Worker is doing during a representative
ten-second gameplay interval:

| Counter | Delta | Rate/interpretation |
|---|---:|---|
| queued/replayed draws | 56,411 / 56,049 | about 208 draws per submitted batch |
| submitted batches | 271 | 27.1 wakeups/s, not one wakeup per draw |
| fences | 540 | 54/s |
| copied command bytes | 237,898,496 | 23.8 MB/s including each 4 KiB state snapshot |
| producer wait | 1,143 ms | about 11.4% of the interval |
| replay time | 2,920.96 ms | 52.11 microseconds per completed draw |

This rules out a second in-memory ring rewrite as the immediate optimization.
The ring already batches hundreds of draws, and a nested render-Worker CPU
profile attributed only 77.4 ms (0.8%) to JavaScript replay while 3,980.7 ms
(39.4%) was in Wasm raster code and 6,032.9 ms was idle. The original hot Wasm
functions were `viewport_draw_textured_span` (1,734.6 ms),
`d3dim_color_lerp` (931.1 ms), `d3dim_texture_fetch_prepared` (714.7 ms), and
`d3dim_address_texel` (363.8 ms). Command ownership still requires copying
temporary vertices and state before the guest frees or mutates them; removing
those copies would be a semantic change, not an ordinary ring optimization.

The measured hot operation does have useful channel-level SIMD even though the
four texture fetches remain scalar. `d3dim_color_lerp` now widens a packed BGRA
pixel to four i32 lanes, performs the four f32 interpolations together, and
narrows back to the original packed value. Power-of-two WRAP addressing uses
`i & (size-1)`, including negative two's-complement coordinates, instead of a
signed remainder for each bilinear neighbour. In a second nested-worker
profile, completed replay fell from 98.11 to 51.47 microseconds/draw (-47.5%)
despite profiler overhead; `d3dim_color_lerp` itself fell from 931.1 to 227.8
ms (-75.5%), and render-Worker idle share rose from 59.7% to 74.9%. The indexed
texture regression retains centre-linear averaging, WRAP/CLAMP, all exercised
texture formats, blending, and depth behavior, and the full dual build passes.

Two `fable-review.md` findings were addressed at the same boundary. Encoder
memory/slot views and consumer batch/memory views are cached, eliminating the
per-command/per-batch `DataView` and `Uint8Array` objects. More importantly,
the render-only instance no longer calls `init_thread(63)`, whose page-directory
reset was outside the eight-slot arena. A narrow `d3dim_worker_init` now sets
only image translation and its private heap-arena globals; the renderer never
claims guest thread/cache/page slots. Surface `Lock` already fences before
exposing CPU-writable pixels, so the subsequent `Unlock` can publish its epoch
without an extra global stall and later draws observe it in guest order.

The remaining low gameplay FPS is therefore not primarily command parsing or
ring allocation. Even before SIMD the render Worker was idle most of the time,
while the guest-main Worker stayed busy emulating x86 and generating commands.
The next renderer experiment, if another representative profile still names
it, is incremental span interpolation and specialization of the common 16-bit
texture fetch. The larger remaining ceiling is the settled-cockpit x86 hot-loop
work documented below.

There is a separate hardware option worth retaining. The repository's OpenGL
frontend already batches guest calls and renders through a WebGL fixed-function
compatibility layer. A future `software-direct | software-worker | webgl`
backend choice could translate D3D draw/state packets into that renderer. It is
most attractive for later D3D versions where applications cannot freely lock
the render target. It is not a drop-in optimization for MW3: D3D3 surface
locking, color keys, palettized/RGB565 textures, fixed-function blend/fog/light
rules, depth precision, and readback still require an explicit compatibility
contract and the same fences. Keep it independent from the software-worker
transport so hardware translation bugs cannot weaken the known-correct CPU
fallback. `fable-review.md` also identifies per-word `DataView` allocation in
`gl-command-stream.js` and per-vertex copying in `gl-compat.js`; remove those
costs and measure the native OpenGL path before treating it as a performant D3D
backend substrate.

### Settled-cockpit x86 profile and disassembly

The allocator investigation above measured the wrong phase before its scope was
corrected. The useful profile is a deterministic moving-cockpit interval: the
visual wait accepted the cockpit at batch 888, `W` went down at shifted batch
958, and handler/hot-block recording covered batches 1000 through 1100. All
four runs used the same no-threads route, 200,000-block slices, quiet API/block
logging, and the public `_set_sbh_threshold(0)` fix. These counts measure guest
threaded dispatch, not wall time or Direct3D raster cost.

| Gameplay build | Handler dispatches | Delta from prior | Delta from initial |
|---|---:|---:|---:|
| Authentic MSVCRT `_ftol`, ordinary x87 branches | 123,275,668 | — | — |
| WAT-native ABI-correct `_ftol` | 117,610,360 | -5,665,308 (-4.60%) | -4.60% |
| Native `_ftol` plus H439 x87 status-branch fusion | 111,232,878 | -6,377,482 (-5.42%) | -12,042,790 (-9.77%) |
| H439 plus browser-equivalent MW3 COPY opt-in | 104,827,560 | -6,405,318 (-5.76%) | -18,448,108 (-14.96%) |

The first three CLI profiles did not pass `--copy-superops`. That is a real
harness distinction: the browser reads `copySuperops: true` from MW3's app
manifest, while `test/run.js` deliberately requires its explicit CLI switch.
The fourth row uses the switch and therefore includes both exact MW3 lowerings,
H436 and H440. The 6,405,318 delta must not be attributed to H440 alone.

The first baseline's hottest block was runtime `0x0180cdc1`, the rebased body
of the authentic Win98 MSVCRT `_ftol` at original `0x78004dc1`. This is not an
allocator and its traffic is not startup residue:

```asm
78004dc1  push ebp
78004dc2  mov  ebp,esp
78004dc4  add  esp,-0xc
78004dc7  wait
78004dc8  fnstcw [ebp-2]
78004dcc  mov  ax,[ebp-2]
78004dd0  or   ah,0xc
78004dd3  mov  [ebp-4],ax
78004dd7  fldcw [ebp-4]
78004dda  fistp qword [ebp-0xc]
78004ddd  fldcw [ebp-2]
78004de0  mov  eax,[ebp-0xc]
78004de3  mov  edx,[ebp-8]
```

It is MSVC's signed-i64, truncate-toward-zero helper. The EXE has 489 static
call sites, but return-address attribution accounts for 435,868 of the 435,943
sampled calls and shows that four sites dominate:

| Call instruction | Calls | Purpose from surrounding disassembly |
|---|---:|---|
| `0x547a58` | 86,507 | scale and pack per-vertex alpha/intensity |
| `0x547c71` | 86,507 | scale first lit vertex color component |
| `0x547c83` | 86,507 | scale second lit vertex color component |
| `0x547c98` | 86,507 | scale third lit vertex color component |

Those four sites are 79.4% of `_ftol` calls. The surrounding `0x5479e0`
function walks the game's Direct3D vertex buffers, multiplies lighting values,
clamps or converts them, and packs 32-bit diffuse colors. Keeping authentic
`malloc/free` while routing only exported `_ftol` to native WAT is therefore a
sound acceleration boundary. The native handler must still pop ST(0), select
truncate rounding, produce the full signed result in EDX:EAX, restore the x87
control word, and remove only its return address. The prior native stub returned
only a saturated i32 and left stale EDX, so it was not safe to enable. Focused
coverage includes positive/negative truncation, a value above 32 bits,
NaN/infinity integer-indefinite, control-word restoration, and stack cleanup.

After native `_ftol`, the largest adjacent semantic pattern was the pre-P6 x87
condition sequence:

```asm
51bc38  fcomp  dword [0x5989d4]
51bc3e  fnstsw ax
51bc40  test   ah,0x41
51bc43  jne    0x51bc4d
```

The same shape repeats through `0x51bc31..0x51bce7` and the `0x5243xx` terrain
work. It is legitimate clamp/physics code: FCOM writes C0/C2/C3 in the x87
status word, FNSTSW copies them into AH, TEST selects the needed conditions,
and Jcc branches. In the native-`_ftol` profile, `H189 -> H217` alone occurred
3,133,484 times, followed primarily by JZ/JNZ. H439 now recognizes only the
exact contiguous byte sequence `DF E0 F6 C4 imm8 Jcc`, publishes the same AX,
TOP/status, byte-width TEST flags and EIP, and ends the block in one dispatch.
It executed 3,167,564 times in the follow-up window. Two dispatches saved per
execution predict 6,335,128 removed operations; the measured 6,377,482 delta is
within 0.04% of total work after normal frame-route variation. A focused short
and near-Jcc regression also proves that a `TEST AL` near miss stays ordinary.

The new top of the x86 profile is now mostly real application work:

| Block / handler | Count | Interpretation and next action |
|---|---:|---|
| H190 / H189 / H188 | 17,868,915 / 10,068,856 / 8,911,103 | scalar x87 memory/register operations; optimize only from repeated verified sequences, not a blanket float rewrite |
| `0x00528268` | 364,175 loop entries | RGB565 color-key row: load word, compare key, conditionally copy, advance; best next exact loop-fold candidate |
| `0x00528275` | 322,048 | tail of the same color-key loop |
| `0x00515a9c` | 169,503 | indexed 12-byte vec3 gather into contiguous scratch; control/index arithmetic dominates and Wasm SIMD has no general gather |
| `0x00528064` | 126,425 | exact MW3 RGB565 alpha-run lowering (active when the COPY opt-in is enabled) |
| `0x0051bf10` | 108,475 | scalar trig/table-lookup helper; possible exact fold, lower priority than the color-key row |

The `0x528268` candidate is especially clear:

```asm
528268  mov  cx,[eax]
52826b  cmp  cx,[ebp+0xc]       ; transparent color key
52826f  je   0x528275
528271  mov  [eax+ebx],cx
528275  add  eax,2
528278  dec  esi
528279  jne  0x528268
```

A bounded exact row super-op removes several dispatches per pixel without
changing DirectDraw ownership. It stays scalar because a destination store may
overlap a later source word; speculative multiword loads would change the x86
result. Recognizing the loop is the primary win even with scalar Wasm. The vec3
gather at `0x515a9c` is a weaker SIMD target
because each source is selected by an index and only the 12-byte copy is
contiguous. The broad x87 total likewise does not justify converting the whole
emulated stack to SIMD; its dependencies are scalar and compatibility requires
x87 status, rounding, NaN, and 80-bit-adjacent behavior. Exact sequences and
renderer spans remain the safer acceleration boundary.

### RGB565 color-key row lowering and corpus scope

H440 recognizes the complete verified 19-byte sequence at any guest VA, under
the same process-wide MW3 COPY opt-in as H436. The emitter derives and records
the loop's back/fall addresses from the matched location rather than embedding
the demo's `0x00528268`, so differently linked game builds can reuse it. It
loads the transparent RGB565 key from `[EBP+0x0c]`, takes the source cursor from
EAX, destination displacement from EBX, and count from ESI. The executor is a
scalar Wasm loop by design: every conditional store to `[EAX+EBX]` occurs
before the next `[EAX]` load, so forward-overlapping source/destination ranges
retain x86 read-after-write behavior. It also preserves ECX's upper half,
publishes ADD-then-DEC lazy flags in the original order (DEC retains ADD's CF),
and charges the guest instruction and two-block-per-pixel budgets.

`test/test-mw3-rgb565-colorkey-run.js` extracts the authentic bytes from the
pinned demo and compares H440 with ordinary x86 for transparent and copied
pixels, 1/8/37-pixel counts, disjoint storage, and both overlap directions. A
`dst = src + 2` case specifically fails any implementation which batches loads
before stores. The same authentic bytes are also injected at a second arbitrary
VA to prove recognition and control flow are address-independent. A valid
one-byte addressing near miss remains ordinary x86.

A static corpus scan checked 1,108 paths / 585 unique PE files in `binaries`
and `test/binaries` for both the exact bytes and a register-flexible structural
form (`load16; cmp16 key; conditional skip; store16; +2; counted back edge`).
Only `mech3demo.exe`, file offset `0x127668`, VA `0x00528268`, matched. This does
not mean color-key blitting is unique to MW3: the WAT-native DirectDraw
`BltFast` path already implements ordinary source color keys, so applications
using the API do not expose an equivalent guest x86 loop to this scan. H440 is
therefore intentionally an MW3-only fold, not a claimed corpus-wide primitive.

In the deterministic moving-cockpit interval, enabling the browser-equivalent
COPY gate removes both `0x00528268` and `0x00528275` from the hot-block list and
drops dispatch from 111,232,878 to 104,827,560. Fresh cooperative and real
guest-Worker captures with that gate are pixel-identical. Each measured 2,411
exact colors, 423 quantized colors, 128 terrain bins,
75,040 orange-sky pixels, 75,053 dark-cockpit pixels, and 2,936 green HUD
pixels, with zero cyan/magenta artifacts. The CLI gameplay acceptance now
passes `--copy-superops` so it tests the same opt-in arm as the browser.

### In-place terrain/grid filter lowering

The next target was selected from sampled CPU time rather than block count
alone. Corrected gameplay profiles put the interpreter's `$next`, register
accessors, branch return path, and `$g2w` address translation ahead of any one
software-D3D helper. The settled hot-block profile then identifies
`0x00518f02..0x00518f67` as the strongest loop which exercises all four: it
enters 116,300 times in the 100-batch interval and executes 37 x86 instructions
per cell.

The loop is an in-place 16-bit terrain/grid filter. Each trip performs twelve
loads and two stores across the current, upper, lower, and parity rows. Its one
guest `JNZ` backedge is predictable except at exit; the branch-pressure concern
is instead the threaded interpreter's changing `return_call_indirect` target
for each of the 37 handlers. Browser/Node V8 profiling on this macOS host does
not expose retired-branch or branch-miss hardware counters, so no
"mispredictions removed" number is claimed. Handler dispatch is the observable
proxy: H441 replaces those 37 changing indirect calls with one scalar Wasm loop
branch per cell and one handler entry per safety chunk.

H441 is gated by MW3's existing COPY opt-in and proves the complete authentic
101-byte body with a hash plus structural head/tail checks. It derives its
back/fall addresses from the matched location. The executor preserves the
original load/store order and ADD-then-DEC flags; vectorizing multiple cells is
not valid because a store from cell N can feed a neighbour load at cell N+1.
It reduces translation overhead without pretending memory traffic vanished:
the same twelve loads and two stores still occur, while adjacent word groups
use three affine-span translations plus the parity-byte translation instead of
up to fourteen separate guest-memory helper translations per cell. Stack
locals use one additional affine translation per safety chunk and are reloaded
in their original order, so intervening stores remain observable.

`test/test-mw3-grid-filter-run.js` extracts the pinned bytes and compares
ordinary and H441 execution for 1/8/37 cells, registers, flags, full memory, a
relocated body, and a valid one-byte near miss. Across those rows the ordinary
stream retires 1,705 handlers and H441 retires seven (one per safety chunk plus
the final returns). This is an isolated mechanism measurement, not an FPS
claim.

The matched settled-gameplay A/B is the useful whole-window result:

| Gameplay build | Handler dispatches | Delta |
|---|---:|---:|
| H439 + H436/H440 COPY opt-in | 104,827,560 | — |
| Same build + H441 grid filter | 100,531,476 | -4,296,084 (-4.10%) |

`0x00518f02` disappears from the hot-block list. The cooperative gameplay gate
still measures 2,411 exact colours, 423 quantized colours, 128 terrain bins,
75,040 orange-sky pixels, 75,053 dark-cockpit pixels, and 2,936 green HUD
pixels, with zero cyan/magenta corruption. Wall time and web FPS remain
unquoted because the shared host load exceeded the repository's measurement
threshold throughout this run.

This profile also bounds what x86-only work can accomplish. H439, the COPY row
folds, and H441 together reduce the initial matched gameplay window from
123,275,668 to 100,531,476 guest dispatches (-18.45%), but the earlier wall CPU
profile attributed a separate roughly 20.1% named share to D3DIM/software
rasterization. Both sides are material. A dedicated render Worker can overlap
them in Threads mode, as designed above, but does not reduce total raster CPU.
The highest remaining exact block entry is the MSVCRT `_ftol` import trampoline
at `0x005776a0`, followed by the vector gather at `0x00515a9c` and block
`0x00518f8c`; the next decision should come from a matched moving-frame wall
profile on a quiet host rather than another startup or fixed-batch timing claim.

## Non-finite multi-texture coordinates erased near terrain (2026-08-30)

The solid-black camera-near terrain was longstanding and reproduced in a
capture from before the render-Worker work. It was not clipping, depth, missing
texture upload, or the threaded command stream. MW3 submits the affected
five-vertex fan as `D3DFVF_XYZRHW|DIFFUSE|SPECULAR|TEX3` (FVF `0x3c4`) in three
passes: a valid RGB565 base texture through TEX0, a light map through TEX1,
then an all-white no-op modulation texture through TEX2. The last coordinate
pair contains NaN/Infinity.

Point filtering already reached texel zero because Wasm's saturating float to
integer conversion maps those values to zero. The linear path instead kept the
non-finite values in its fractional weights. All four fetched texels were valid
white texels, but the packed-colour lerp received NaN weights; its saturating
channel conversions produced black, so `ZERO/SRCCOLOR` modulation changed the
representative foreground pixel from RGB565 `0x3964` to `0x0000`.

`d3dim_texture_sample_prepared` now canonicalizes non-finite U/V to zero before
either filtering path. The same representative pixel remains `0x3964` through
Flip, and the deterministic 640x480 gameplay capture has 10,000/10,000 lit
pixels in the central foreground box instead of an all-black fan. The focused
sampler regression uses a uniform RGB565 texture with NaN/Infinity coordinates;
the gameplay test separately guards the actual near-terrain coverage in both
cooperative and Threads modes.

## The two D3DIM backends disagree about terrain colour (2026-09-20)

The `test/test-mw3-gameplay.js` route reaches the cockpit on the WebGL D3DIM
executor as well — same command with `--headless-gl --d3dim-gpu` added (and the
display held awake: `nohup caffeinate -d -u -t 2400 &`). The GPU arm reports
`draws=74594 triangles=136528 fallbacks=0`, so the executor is doing all of it.

The frames are not the same. Sky, cockpit, HUD, radar and the 'Mech thumbnail
agree; **the terrain does not** — it is green on the software rasterizer and
brown/tan on the executor. Measured at `--tolerance=32`: 4.07% of pixels differ
between arms, against a null band of 0.026% (the software arm run twice). At
tolerance 0 the software arm differs from itself by 33%, so only the toleranced
number means anything on this scene.

That is a hue difference on one textured surface, not a sharpness or filtering
difference, which makes it look like a real disagreement rather than a
convention gap. Not yet chased. Captures:
`build/d3d-backend-coverage/mw3-{software,gpu}-canvas.png`, plus a diff image;
full method in [docs/d3d-backend-coverage.md](../d3d-backend-coverage.md).

Note the 2026-09-19 corpus sweep scored MW3 `IDENTICAL, 0%`. It was comparing a
menu: a startup slice never reaches the cockpit.

### Resolved (2026-09-23): the software arm's 565 dither was biased dark

**The WebGL arm was right.** The near terrain is the brown base texture
(slot 319, 128x128 565, mostly `#6b5139`) times grey vertex diffuse
`0xff737373`: `#302418`, which is the executor's `#312418` to the bit.

A `--watch-word` on one back-buffer pixel (slot 6, pixel 80,320) gave its
value after each of the three passes on the software arm:

| pass (return address) | 565 | colour |
|---|---|---|
| base `MODULATE`, TCI 0 (`0x54a87f`) | `0x28e2` | `#281c10` brown -- correct |
| light map `ZERO/SRCCOLOR`, TCI 1 (`0x54a991`, ESI=1) | `0x20c1` | `#201808` |
| all-white no-op `ZERO/SRCCOLOR`, TCI 2 (`0x54a991`, ESI=2) | `0x18a0` | `#181400` olive |

The last pass multiplies by pure white (`--dump-dx-surfaces` confirmed
slot 1401 is 1024 texels of `#ffffff` at that very frame), yet it took every
channel down exactly one 565 step. The cause was `$d3dim_pack_rgb565`:
`DITHERENABLE` added a Bayer threshold **centred on zero** (`-4..+3` for
red/blue) and then truncated. Truncation already rounds down, so the pair is
half a step dark on average, and a destination read back from 565 (red 4 reads
as 32, the bottom of its bucket) lands one step lower on half the pixels. Each
read-modify-write pass drifts darker; at these levels blue is only two steps
above zero, so two passes erase it and brown becomes olive. The threshold is
now `[0, step)`, which is unbiased and leaves exactly-representable pixels
alone; `test/test-d3dim-dither-bias.js` checks both properties over all 65536
565 values and the whole 4x4 cell.

Ruled out on the way, so nobody re-checks them: `TEXCOORDINDEX` (both arms get
the same packed TL vertices), texture decode (both call
`$d3dim_texture_fetch_prepared`; the a4444 set decodes to sensible sprites),
the inline `fast16` sampler (forcing the general sampler changed nothing), the
`SRCALPHA/INVSRCALPHA` overlay pass, and fog (FOGCOLOR is never set; neither
arm implements D3DIM vertex fog, which MW3 enables with fog factor in specular
alpha, e.g. `0xd4`).

`test/test-mw3-gameplay.js`'s cockpit gate was tuned on the olive frame: the
dark terrain counted as near-black, and 85k-140k matched a transitional frame
at batch ~882. Loading frames are ~183k near-black and the corrected cockpit
~42k on both arms (GPU 43.3k), so the window is now 30k-70k. Both modes pass.

### 2026-09-28: selective page tracking, remote menu A/B

Compared `ff6dc0f4` with its parent on quiet remote box 8, headful Chrome and
real Workers, in A/A/B/B/A order. Two 15-second windows after 60 seconds of
settling showed 23.92/42.72, 23.98/43.07, 23.24/32.46, 24.26/42.06 and
24.20/32.33 guest presents per second. Captures show the animated menu;
the slow second window occurs with and without tracking. Mean difference
(-3.8%) is smaller than the baseline repeat spread (15.7%): no causal
dirty-tracking regression established, and no claim of zero overhead.
Zero texture uploads/comparisons in these windows; framebuffer byte checks
total only about 4-5 ms per second window. Do not attribute menu slowness to
gigabytes of texture checks. Full method, limitations, artifacts and commands:
[dirty tracking measurements](../d3dim-dirty-tracking-perf.md#mechwarrior-iii-menu-remote-regression-check-2026-09-28).

The browser harness needs `?debug` to retain MW3 in this snapshot's picker.
Waiting for present counts alone is not a menu gate: the startup fade also
presents. Earlier failed-launch/startup probes were excluded.

Follow-up 2026-09-29: four 60-second per-present captures in A/B/B/A order
show pooled 23.00/s before vs 21.99/s after, median 43.0/45.3 ms and p95
79.6/80.5 ms. Each run has one ~1.01s and one ~5.00s presentation gap, then
a burst of presents; the last 30 seconds run near 13/s in both arms. Pacing
is not stable. The longer samples suggest modest tracking overhead (-4.4%
average), but the large gaps predate it. Intentional guest wait vs emulator
stall remains untraced. Raw timestamps and full table are in the linked report.

### 2026-09-29: gaps are scripted WAIT; active menu has a decode storm

The uncertainty above is resolved. The `ATTRACT` script in `reader.zbd`
(offset `0x3487a`) explicitly runs `WAIT 1.0` and `WAIT 5.0`, around a splash
image. Parser `0x562dd0` matches the `WAIT` string at `0x5bc2c4`, constructs
vtable `0x599cd8`, and its method `0x563c60` polls elapsed time without drawing.
Guest samples during the gap hit `0x563c73`, the dispatcher `0x5633f0`, input
polling and the timer/message loop. Zero sleep/wait yields. These long gaps
are guest animation pacing; the unattended menu benchmark entered attract
mode. They must not be described as emulator freezes.

The slow active menu is different: whole-loop alpha fold `0x528064..0x528111`
and internal entries `0x5280f4` / `0x52807b` repeatedly retire one another.
A bounded trace captures 1,000 such retirements, all with `in_code_write=0`.
The interior entries can be entered by micro-op fallback. The whole-loop
matcher lacks the interior-entry protection that smaller folds use.
29 seconds of slow animation rebuilt 47.6M blocks and retired 47.0M.
Worker profile: 22.84% publishing, 12.74% decoding, 11.82% alpha recognition.
This is cache churn, not megabytes of texture checking. The alpha matcher now
uses `$fuse_stop` to preserve independently compiled interior entries, while
retaining the native fold for cold loops. The authentic-loop overlap test
fails before the fix and passes afterwards (both stores, correct pixels,
zero warmed recompiles/retirements). Full isolated build and code-write
regression pass.

Unprofiled remote ABBA on pinned `ff6dc0f4` versus only this guard improves
30-second throughput from 29.06/31.39 to 76.82/73.55 guest presents/s (2.49x
mean), reducing retirements from ~36.3M to ~3.8M per window. These windows
still include scripted waits; small periodic mouse movements did not stop
attract mode. See the linked report for frame-time percentiles and phase
limitations. This fixes the alpha-fold conflict, not every remaining retirement.

The benchmark also had a repeated GPU-name query costing 7.6% sampled worker
time. Fixed in the bench tool by caching once per GL context; prior rates
include that artificial overhead. See the full linked report for artifacts,
named-build verification, and corrected profiling limitations.

The separate active-animation pair (`--warmup-ms=95000`, 30-second capture)
contains no scripted gaps: 14.59 → 78.74 presents/s; median 70.49 → 13.42 ms;
p95 74.96 → 18.04 ms; worst 80.00 → 31.53 ms. All 437 control intervals
exceed 50 ms, versus none of 2,362 fixed intervals. Per-second fixed counts
still vary 60–151 with the animation. Retirements fall 47.69M → 2.18M.

### Remaining color-key overlap (2026-09-29)

With the alpha guard enabled, a fresh bounded retirement trace at 95 seconds
finds the same conflict in the color-key row: `0x528268..0x52827b` versus
its interior store at `0x528271`. Of 995 retirement records, 494 are the
whole row evicting the store and 494 are the reverse; all are outside code
writes. The other seven records are initial splits. Parse `0xCAC0DE02`
markers rather than assuming every five logged words form a record: other
diagnostic messages can occur between them.

`$try_emit_rgb565_colorkey_run` now declines a candidate containing an
existing interior entry, using `$fuse_stop` after the exact-byte check.
The overlap regression covers all six interior instruction boundaries,
correct output and zero warmed retirements/recompiles; the cold native fold
remains enabled. The test fails before this guard and passes after it.
The standalone H440 test also passes its ordinary/fused pixel, register,
flag, relocation and source/destination-overlap comparisons.

The guard alone removed churn but cost 4.3% throughput in a longer matched
capture. The implementation therefore also splits a predecessor before the
exact native row and makes micro-op compilation exit at that row, preserving
native execution instead of repeatedly creating an interior-store fallback.
The exact-byte matcher is shared by the decoder and compiler; there is no
guest-address special case. Tests verify native execution through a preceding
block and refusal to install a micro-op program over the native row.

The revised two-minute menu capture reduces retirements 7,556,801 → 4 and
decodes 7,972,493 → 5. Throughput is 82.98 → 81.78 presents/s (-1.45%):
the sustained churn is removed, but this is not an established FPS win.
The final isolated build, overlap test, H440 equivalence and micro-op compiler
suite pass. The extra local cockpit acceptance timed out without a capture;
combat remains unvalidated by this follow-up. Full results and artifacts are
in the linked dirty-tracking report.

A fresh 30-second active-menu confirmation of the final version reaches
85.40 presents/s with zero retirements/decodes, p95 17.76 ms and worst
39.27 ms. No >50 ms intervals. This verifies the cache result across a fresh
launch; no repeatable FPS gain is claimed.

The alpha-only profile already spends 47.25% of sampled worker wall time in
`uop_fast`, with 15.74% idle; decoding is no longer the dominant sampled
cost. Thus retirement reduction alone is not evidence of another large FPS
gain. Trace/profile artifacts: `build/mw3-watch-ab-results/mw3-fixed-retirement-trace`.

## Remote WebGL cockpit profile after cache fixes (2026-09-29)

The browser now reaches verified Instant Action gameplay via
`tools/bench-d3dim-gameplay.js --app=mw3 --route=gameplay --warmup-ms=15000`.
`tools/mw3-gameplay-route.js` creates pilot ACE in a fresh context, accepts
Instant Action, checks the operation-map image, waits ten seconds for its
deployment button to become active, and verifies orange sky plus advancing
3D geometry after deployment. The first automated attempt clicked too early
and remained on the operation map; its timeout is not a gameplay measurement.
Stage screenshots remain part of acceptance. Runtime logging is disabled.

Box8, headful Chrome 151, Threads enabled, actual renderer
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 Mesa 23.2.1)`.
This deliberately reuses the menu experiment's pinned ff6dc0f4 closure plus
the final alpha/color-key overlap fixes, rather than the concurrently changing
main worktree. WASM SHA-256:
`d3919ebcb7c1351a6539c620a504532bfe1a30f035e737e3b792d1f16e515d86`.
The run manifests pin GPU JS and region-map hashes too. These are baseline
measurements of the fixed build, not a gameplay A/B or Safari performance claim.

Three unprofiled, stationary-cockpit windows (`mw3-cockpit-unprofiled2`):

| 20-second window | Presents/s | Median ms | p95 ms | Worst ms |
|---|---:|---:|---:|---:|
| 0 | 18.24 | 53.70 | 64.36 | 79.36 |
| 1 | 17.97 | 54.58 | 66.70 | 79.71 |
| 2 | 16.68 | 59.34 | 71.35 | 83.98 |

No intervals exceeded 100 ms. The mission continues simulating while the mech
stands still, so the scene/draw count is not constant. Load before/after was
2.12/2.57. Per frame: 1,073–1,134 GPU draws, 1,843–1,970 triangles, about five
readback synchronizations, one target upload, and 2.1–2.9 texture uploads.
GPU sync/readback including pixel conversion costs 13.6–14.7 ms/frame;
draw submission costs 10.0–10.4 ms/frame; target upload costs 1.7–2.1 ms/frame.
These timers are not GPU hardware timing counters or a complete partition.

Texture byte checks remain **zero**, with about 5,200 page checks/frame.
Render-target comparison still examines about 1.23 MB of equal bytes/frame
but costs only 0.67–0.68 ms/frame here. Cache retirements are 207, 18, 14
per window, unlike the millions observed in the old menu overlap failure.

Separate three-window CPU sampling (`mw3-cockpit-live1`, 16.4–17.8 presents/s)
attributes 48.0% of guest-worker wall samples to WASM. Largest self costs:
`readPixels` 19.0%, `x87_island_fast` 6.5%, `branch_end_at` 5.2%, JS `fence`
3.5%, `th_load32_rop` 3.0%, `getError` 2.5%, `uop_fast` 2.4%.
The page thread is 95.2–95.4% idle. In window 0, 88.6% of `readPixels` sample
time comes through `IDirectDrawSurface::Lock`, and 11.4% through `Blt`.
Thus the next renderer investigation is which surface each Lock/Blt actually
needs: the current fence reads back every dirty target, including pixel
conversion and a shadow copy. Removing a required guest readback would be
incorrect; surface-specific dependency tracking needs separate validation.

Artifacts live under `build/mw3-watch-ab-results/` and on box8 under
`~/mw3-watch-ab/build/d3dim-gameplay-perf/`. Function indices were resolved with
a named rebuild whose noncustom WASM sections exactly match the measured
binary. The interactive profile's original manifest has a stale menu note;
`mw3-cockpit-live1/scene.json` records the corrected cockpit attribution.

A second unprofiled run, `mw3-cockpit-moving1`, holds top-row 5
(`--guest-key=53`), the included demo readme's 50%-throttle binding. Screenshots
confirm changing terrain and a 45-speed HUD reading. Three 20-second windows:

| Moving window | Presents/s | Median ms | p95 ms | Worst ms |
|---|---:|---:|---:|---:|
| 0 | 16.04 | 61.35 | 77.07 | 102.73 |
| 1 | 20.29 | 49.09 | 57.36 | 68.01 |
| 2 | 18.99 | 51.67 | 63.27 | 102.46 |

Two intervals exceed 100 ms, none exceed 250 ms. Per-second counts range
14–22, so moving gameplay is scene-dependent rather than a locked frame rate.
Load before/after is 1.69/2.79. Draws/frame vary 578–1,140, but about five
readbacks/frame remain, costing 15.0–17.4 ms/frame. Texture byte checks remain
zero. There are 44/32/0 renderer fallbacks across the windows and zero GPU
errors; this is predominantly WebGL with occasional software fallback, not
evidence that every draw is hardware-rendered. A future profile should identify
those fallbacks separately. This run captures pacing, not a moving CPU profile.

The same run confirms the Threads cursor-visibility bug: the page WASM reports
display count **0**, while the executing guest Worker reports **-1**. Both
report cursor handle 425728. `ShowCursor` changes an instance-local global,
but `renderer.wantsHiddenMouse` reads the page instance. MW3 also lacks the
explicit `relativeMouse` opt-in and Moorhuhn's `hideHostCursor` manifest override.
Moorhuhn's override is not evidence that its desktop input already uses relative
motion. No cursor behavior was changed in this profiling task.

## Surface-specific WebGL fences (2026-09-29)

`--trace-fences --frame-times` on the browser benchmark records each actual
readback's target/DIB, preceding DirectDraw surface event, count, and one stack
per combination. The preceding event is context, not necessarily the caller:
after narrowing Lock, the same texture event remains current when Texture2
Load and Release issue later global fences. The recorded stacks identify those
callers. The diagnostic capture `mw3-surface-trace1` reports exactly five
640x480 color readbacks/frame: three color-buffer Locks, one unrelated texture
Lock (slot 1400), and one depth-surface Blt/COLORFILL (slot 10).

The WebGL FENCE opcode now accepts a WASM backing address and length; zero
length retains the global barrier. It flushes every dirty target whose byte
range overlaps the access, including aliases. It returns 1 when no target is
dirty and 2 when unrelated targets remain pending. WAT preserves that pending
state so a later global fence cannot miss deferred work. Software render-worker
execution and deferred presentation retain global ordering.

DirectDraw Lock and Blt use the scoped barrier, as does Texture::Load for both
source and destination. Partial writes conservatively synchronize the entire
surface; no overwrite/discard assumption was added. Nonfinal WebGL surface
reference drops no longer synchronize pixels. Texture interface Release
delegates to that surface path instead of fencing a second time. Final
destruction still globally fences before freeing backing memory.

The intermediate experiments matter: Lock/Blt alone reduced five readbacks to
four, but the texture-related readback moved to Texture::Load. Narrowing Load
moved it again, to the following Texture2::Release. Skipping only the nonfinal
reference barrier addresses that sequence without removing lifetime safety.

`test/test-d3dim-surface-fence.js` checks unrelated/overlapping ranges, exact
RGB565 readback bytes, pending-state propagation, software/global barriers,
a real WAT Texture::Load consuming fresh GPU source pixels, and nonfinal versus
final Release. The indexed-texture conversion/color-key regression and texture
release/arena regression also pass. An isolated full build passes; the shared
main build encounters the pre-existing union-gate failure for
`10a-gdi-bitmap.wat:1014`, unrelated to these changes.

Final remote run `mw3-surface-final4` reduces actual readbacks from **5 to 3 per
frame (40%)**, apart from three incidental fallback/lifetime synchronizations
in the first window. The remaining recurring stacks are color-buffer Locks.
Each avoided readback is 640x480 RGBA (1,228,800 bytes), followed by RGB565
conversion and a shadow copy, so two avoided calls save 2.46 MB/frame of GPU
readback alone. No render-target Lock was skipped.

| Run / 20s windows | FPS | Readbacks/frame | Sync ms/frame |
|---|---|---|---|
| Control `surface-control2` | 17.39 / 17.23 / 16.84 | 5.01 / 5.01 / 5.00 | 13.44 / 13.50 / 13.42 |
| Final `surface-final4` | 18.79 / 18.79 / 16.89 | 3.01 / 2.99 / 3.00 | 11.49 / 10.53 / 12.68 |

Do **not** attribute the entire 17.15→18.16 mean-FPS difference to this change:
the browser mission differs between launches (about 1,248 draws/frame in this
control versus 1,072 in the final run). The earlier control with ~1,073 draws
also reached 18.24/17.97 FPS in its first two windows. A repeatable FPS gain is
not established; the 40% reduction in recurring readbacks is. The final run
has zero GPU errors, two software fallbacks, p95 62.7–71.8 ms, and one 100.5 ms
interval. Screenshots retain the cockpit, sky, terrain and HUD. Load before/
after is 0.01/2.33. Final pinned WASM SHA-256:
`ad5e74dd3f58f0cf9bfc26f4fa205e71ebaf687bb6d5d27c76d039493e724962`.

The final moving validation (`surface-final-audit`, 50% throttle, 20 seconds)
passes **1,233,496 byte-backed dirty-page audit checks with zero misses**, zero
GPU errors and no browser errors. Its screenshot shows advancing terrain and
45 speed. Audit instrumentation performs comparisons intentionally, so its
13.8 FPS is not an ordinary-performance measurement.

### Remaining color-buffer Lock callers

Remote `mw3-lock-access2` uses the same pinned surface-fence WASM and GPU
source with `--frame-times --trace-locks --warmup-ms=15000 --seconds=10
--windows=1`. It records 555 readbacks / 185 presents (three per frame), zero
GPU errors and zero fallbacks. The diagnostic run measured 18.43 FPS; snapshot
copies and byte comparisons make this unsuitable for an optimization A/B.

Every recurring color Lock is slot 6, null rectangle (whole 640x480 surface),
flags 1 (`DDLOCK_WAIT`), without read-only, write-only or discard permission.
`0x541820` calls the backend Lock through `[0x7c546c]`, then installs the
returned pixel pointer/pitch in software-drawing state. The backend chain is
`0x5420a0 -> 0x542140 -> surface.Lock`; the API return is `0x542165`.
MW3 omits frame pointers here. Raw stack offsets +36, +168 and +172 recover
`0x5420d8`, `0x54182b` and the distinct caller below; an EBP walk alone
does not identify the three sites.

| Caller return | Code around the lock | First three sampled intervals |
|---|---|---|
| `0x46a513` | CPU drawing after the game object's render call | 10,114 / 10,113 / 10,114 changed bytes; bounding rectangle `[5,5,639,333)` |
| `0x46a425` | Lock, call `0x570850`, Unlock (`0x541880`) | No changed bytes |
| `0x56facb` | Conditional re-lock at a rendering helper's exit | No changed bytes |

The first site's sparse changes span most of the screen horizontally. These
are **changed-byte bounds**, not access bounds: unchanged bytes can have been
read or written with the same value. The latter two sites are candidates for
deferred synchronization, but this capture does not prove they never read
pixels. Texture locks (slots 1400/1402) still occur without recurring color
readbacks, as intended by the committed fix.

No additional renderer optimization is justified by Lock rectangles or flags
in this trace. A safe next mechanism is lazy synchronization on the first
actual CPU access to a GPU-newer surface, covering reads and partial writes
before memory is consumed or modified, including native/folded memory paths.
Locks that never access pixels could then avoid readback. Existing write-dirty
flags alone cannot detect a CPU read or preserve untouched pixels before a
partial write. Do not skip a fence based on the previous frame's zero changes.

### Software timing, current CPU profile, and pixel access (2026-09-29)

Box8, headful Chrome 151, same pinned surface-fence executable sections as above.
`software-time2` routes into the cockpit with WebGL, fences outstanding work,
then turns off GPU execution and declines the legacy host worker-draw seam.
The latter is necessary: changing `d3dim_gpu_enable(0)` alone still allows
`d3dim_worker_try_draw` to submit to the GPU executor. `software-time1` was
rejected by the zero-GPU-draw assertion and is not a software measurement.
This measures in-guest-worker WAT rasterization, not the separate experimental
software render worker. The retained GPU object only publishes benchmark
counters. Its draw/readback/upload counters stay flat throughout measurement.

Three 20-second windows, no CPU profiler or pixel-access instrumentation:

| Backend / run | FPS | Mean ms/frame | p95 ms |
|---|---|---|---|
| Software `software-time2` | 21.99 / 21.09 / 20.52 | 45.48 / 47.41 / 48.74 | 48.72 / 51.73 / 52.74 |
| WebGL `webgl-time3` | 16.52 / 17.02 / 16.83 | 60.54 / 58.77 / 59.43 | 71.39 / 69.25 / 71.81 |

Aggregate software: **21.20 FPS, 47.17 ms/frame**; WebGL: **16.79 FPS,
59.57 ms/frame**. Software was faster in these runs, but these are independent
live missions, not deterministic frame replay: WebGL draws vary from 1,391 to
1,120/frame, while the earlier `surface-final4` run averaged 1,072 and 18.16 FPS.
Do not turn the observed difference into a fixed renderer speedup claim.
Screenshots show cockpit, sky, terrain and HUD in both. Both runs have no
browser/GPU errors. Software has no >100 ms intervals in these windows.

Separate 20-second named CPU profiles (`webgl-profile3`, `software-profile3`):
the named build's noncustom sections exactly match the pinned WASM SHA above.
Percentages below are **self samples / guest-worker sampled wall time**, not
hardware CPI counters or mutually exclusive subdivisions of the GPU timers.

| Function/work | WebGL | Software |
|---|---:|---:|
| All WASM self samples | 46.96% | 93.48% |
| `viewport_draw_textured_span` | not a leading cost | 37.41% |
| `readPixels` | 17.64% | absent |
| `x87_island_fast` | 6.57% | 7.75% |
| `branch_end_at` | 4.89% | 5.72% |
| `th_load32_rop` | 3.48% | 3.47% |
| `uop_fast` | 2.34% | 2.95% |
| `th_test_jcc` | 2.20% | 2.48% |
| `th_store32_rop` | 1.88% | 2.15% |
| `fpu_exec_mem` | 1.46% | 1.89% |

Software's span loop alone is roughly 19 ms of its 50.66 ms profiled frame.
WebGL also spends 2.83% in `getError`, 2.55% in backend `draw`, 2.30% in
`setUniform`, 2.15% in fixed-function `compile` (not necessarily a shader-cache
miss), 2.15% in `_draw`, 2.12% in JS `fence`, 2.05% in fixed-function `source`,
and 1.85% in `bufferData`. The page thread is 94.27% / 94.84% idle; the guest
worker itself is only 4.25% / 4.52% idle. Floating-point execution, control flow
and operand movement are substantial remaining guest CPU costs.

`tools/bench-d3dim-access-build.js` builds a diagnostic WASM with DIB range
probes at `g2w_slow` and scalar `gl8/16/32`, `gs8/16/32`. Use
`--frame-times --trace-locks --trace-access` with that build. The recorder arms
only the slot-6 640x480 RGB565 backing between Lock/Unlock and captures nine
intervals. Event 90 is translation (not necessarily an actual access), 91 is
a scalar read, 92 a scalar write. Native loops/cached pointers/direct WASM
loads can bypass scalar hooks; these probes identify callers, not a universal
proof of no reads. The persisted builder reproduces the measured diagnostic
binary byte-for-byte on the pinned source closure.

`pixel-access3` observed three repetitions of:

* Return `0x46a425`: no DIB translation or scalar access.
* Return `0x56facb`: no DIB translation or scalar access.
* Return `0x46a513`: 5,304 scalar stores, 7,911 translations (including the
  stores and write barriers), zero scalar reads. `pixel-moving4`, with top-row
  5 held, observes 5,370 / 5,374 / 5,376 stores in this interval, again zero
  scalar reads and no events in the other two intervals. Samples are from
  the beginning of the throttle run, not exhaustive coverage of the mission.

The observed write mechanisms are concrete:

* `0x528268`: color-key copy reads the **source image** and conditionally
  writes RGB565 destination pixels; native `th_rgb565_colorkey_run` calls gs16.
  No destination read is needed by this loop.
* `0x52807b`, `0x5280f4`, `0x5309bf`, `0x530a04`, `0x52fe39`: word stores.
* `0x530e60`: sets **ESP to a framebuffer address**, then uses `push ax/eax`
  to fill a span; captured through `th_push_r16` and native `stack_run_push`.
* `0x528301` loop / `0x52830a rep movsd`: row copies. Sixteen destination
  write-span translations are captured through `page_watch_write_guest` /
  `invalidate_code_write` / `rep_movsd_do`; direct copies bypass scalar stores.

Two implementation paths follow, neither implemented by this investigation:

1. Defer synchronization until the first real CPU access, covering reads,
   writes, stack writes, native loops and host access paths. This can eliminate
   untouched Lock intervals while keeping one conservative readback before
   the first partial CPU write. Translation alone is not an access barrier.
2. Preserve GPU ownership through write-only intervals using exact written
   spans/masks, and upload only those pixels. This could avoid the drawing
   interval's readback too. Page dirty bits alone are insufficient: uploading
   a whole page/row would overwrite untouched GPU pixels with stale CPU bytes;
   comparing to a stale shadow also misses writes equal to old CPU values.
   Any true CPU read must first resolve GPU contents plus pending CPU writes.

Artifacts: `build/mw3-watch-ab-results/mw3-{software-time2,webgl-time3,
software-profile3,webgl-profile3,pixel-access3,pixel-moving4}/`, plus
`mw3-current-profile-summary.json`. These runs change benchmark diagnostics
only; shipping renderer behavior is unchanged.

### Opt-in lazy Lock experiment (`experiment/mw3-lazy-sync`)

The separate worktree `/private/tmp/mw3-lazy-sync` adds a benchmark-only
`--lazy-sync` switch (MW3, WebGL, `--frame-times`, one guest thread). Default
behavior remains eager. This is a single-render-thread experiment, not a
general promise for GDI, multiple guest threads or every native pointer cache.
The benchmark rejects additional live guest threads before enabling and after
each measurement window. There is no new default or shipping UI selection.

Eligible nonprimary, DIB-backed Locks defer their surface fence. A pending
range is checked in the DIB branches of `g2w_slow` and `g2w_affine_span`;
ordinary direct-window heap/code accesses do not acquire another check.
The first overlapping translation/span proof synchronizes the whole surface
before a read or partial write. This is intentionally conservative: proving
a span may synchronize before actual access. The pending range is cleared
before reentering the host fence. Later accesses pay only the DIB branch's
pending-length test. That test exists even with the option disabled.

Arming bumps the existing uop-window epoch so a cached native read window
cannot bypass the new barrier. Nested Locks flush conservatively before
replacing the single tracked range. Global/scoped barriers, software paths,
primary Locks and non-DIB backing retain eager synchronization. An untouched
Unlock drops the access barrier without marking CPU pixels dirty; GPU work
remains pending for subsequent access/presentation/lifetime barriers.

Focused tests verify deferred/untouched cycles, unrelated DIB reads, fresh
first reads, partial-write ordering and untouched-pixel preservation, native
span synchronization, epoch invalidation, eager option-off behavior and global
barrier cleanup. Existing indexed-texture and texture-release/arena tests pass.
Canonical/named compilation passes. The full build stops at the baseline's
known union-gate attribution error in `10a-gdi-bitmap.wat:1014`.

Box8 sequential runs, three 20-second windows each, same pinned executable
base and GPU source, no audit or CPU profiler:

| Arm | FPS by window | Aggregate FPS | Readbacks/frame |
|---|---|---:|---:|
| Original `lazy-base1` | 18.47 / 17.97 / 18.42 | 18.29 | ~3 |
| Candidate, option off `lazy-off1` | 19.51 / 19.26 / 17.97 | 18.91 | ~3 |
| Candidate, option on `lazy-on1` | 21.07 / 20.87 / 18.17 | 20.03 | **1** |

No disabled-option slowdown is visible in these samples, but this does not
measure the added branch's isolated cost: mission geometry changes between
launches and windows. Candidate-off has 1,071 / 1,113 / 1,281 draws/frame;
candidate-on has 1,070 / 1,071 / 1,294. Do not claim a fixed FPS percentage.
The directly established result is **three recurring readbacks become one**.
Five Locks/frame are armed: two texture accesses and one color access touch
memory; two color Locks remain untouched. Only the color access requires an
actual GPU readback. Candidate-on has exactly one upload/frame.

Sync time is 7.96 / 8.16 / 9.16 ms/frame on, versus 11.35 / 10.78 / 10.34 off.
Render-target comparison time falls from ~0.67 ms/frame to 0.0035–0.0040:
untouched Unlocks no longer trigger conservative whole-surface notifications.
All timing runs have zero browser/GPU errors. Screenshots retain cockpit,
terrain and HUD. Remaining promotion work includes cross-thread ownership,
an audit of retained native/GDI pointers and access ranges at surface edges,
and broader renderer/application coverage. The option stays experimental.

Artifacts are in `build/mw3-lazy-results/` in the experiment worktree and
`~/mw3-watch-ab/build/d3dim-gameplay-perf/mw3-lazy-*` on box8.

The 20-second throttle/audit run `lazy-audit1` completed 1,460,911 dirty-page
audit checks with zero misses, zero GPU errors and no browser errors. It
retained two untouched Locks/frame and 1.003 readbacks/frame (one incidental
extra synchronization). Its screenshot shows the progressing mission, terrain,
HUD and another mech. Audit FPS (15.43) includes deliberate byte comparisons
and is excluded from the timing table. Measured named candidate SHA-256:
`e1be4076cf7f91f1629acc44f8478749d941bc1a2ca22e22f7a55b4e2b3e9c8b`.


### Merge and default evaluation (2026-09-29)

Merged into main at `a4f6b4a1`; **lazy synchronization remains disabled by
default**. The benchmark now accepts the established NFS3/GTA2/SDK routes and
`--lazy-sync-startup` enables the experiment before guest execution. Eligibility
also requires page-aligned DIB backing: otherwise a scalar access starting
before an unaligned surface could overlap it without another translation.
The focused surface-fence test verifies this eager fallback.

Box8 sequential compatibility runs (`lazy-coverage2-off/on`), same candidate
WASM and pinned GPU source, 10-second windows after warmup:

| Application | Off FPS | On FPS | Result |
|---|---:|---:|---|
| SDK Boids | 71.03 | 73.43 | Both pass, zero GPU/browser errors |
| SDK Flip3DTL | 186.07 | 179.36 | Both pass, zero GPU/browser errors |
| NFS3 demo | — | — | Both fail page protocol timeout before measurement |
| GTA2 demo | — | — | Both refuse multiple guest-worker present recorders |

Neither SDK sample arms a lazy Lock, so these are compatibility controls,
not evidence that deferred CPU access is safe in other games. Their short
windows do not establish a performance improvement or regression. Heroes II
also reaches its adventure map (1,864 presents) with the candidate's default
software/eager path; this does not exercise GPU lazy synchronization.

GTA2's multiple guest instances reinforce the outstanding ownership issue:
the pending range currently belongs to one WASM instance, while guest memory
is shared. NFS3 needs its baseline route/debugging resolved before it can be
counted as coverage. Retained native/GDI pointers also remain unaudited. Those
gaps rule out enabling this globally despite the demonstrated MW3 reduction
from three readbacks to one. Artifacts: experiment worktree
`build/mw3-lazy-results/*-lazy-coverage2-{off,on}/`.

### Shared synchronization follow-up (2026-09-29)

Commit `1730589d` replaces the instance-local pending range with shared state
and synchronization. The subsequent [real-game A/B](../lazy-sync-game-results.md)
measured 21.29 FPS OFF / 22.64 ON, with GPU readbacks dropping from 3.016 to
1.011 per frame. ON submitted about 10% fewer triangles, so the FPS difference
is not an isolated speedup measurement. Each launch created a helper that
exited before measurement; persistent thread history catches this startup
activity. Global enablement was initially deferred based on GTA2's extra backend fence call with
no readback reduction, and the documented retained GDI/native-pointer limit.

The subsequent scoped-barrier correction removes one duplicate guest fence
per cockpit frame: **4.00 → 3.00**, retaining one readback. Matched lazy-ON
before/after runs measured 22.41 / 22.97 FPS, but geometry and host load vary;
this establishes a request-count saving, not an isolated FPS improvement.
Publication waits remain about 1 ms/frame. See the same report for artifacts.

The later shared-WebGL rollout enables lazy sync by default. Use
`?no-lazy-sync` or uncheck **Lazy sync** in the debug toolbar for eager readback;
the checkbox also applies to running guest workers.

The [P/PC repeatability follow-up](../fp-mw3-repeatability.md) found that
`processSharedCtx()` omitted `wallNowMs`: the cooperative loading thread could
read the host date while the main thread read the pinned calendar. Adding the
shared key makes P/P match at all 1,750 recorded batch boundaries; pinning file
timestamps alone did not (first loading-thread divergence at batch 742).
Six subsequent untraced 2,400-batch cockpit windows pass image/API/tier-counter
checks. Balanced P/PC user CPU is 83.1945/84.5155s on EPYC/V8, a 1.588% slowdown
for the countdown, with +1.225%/+1.952% in the two orders. The older -3.85%
single-pair observation is not reproduced; C remains experimental.

## Game step and headful GAME/s (2026-10-10)

`perf.logicalFrame` is `0x46aa90` (verifier `0x46aa79`, `4200abf30`). WinMain
(`0x579570`) calls the active state's per-frame callback from the table at
`0x58e118`; in a mission that is `0x46aa90` -> `0x46a9b0`, which reads the
cursor (`GetCursorPos`), runs the update calls (`0x4fa240`, `0x4d3eb0`,
`0x539810`), draws the scene through `[eax+0x50]` and presents through
`0x5419c0` -> `0x544da0` (Flip returns to `0x544e08`, which is also a branch
target of its WASSTILLDRAWING retry loop, so it is not a frame counter).
CLI audit in the cockpit (`test-mw3-gameplay.js` route, batches 960-1060):
31 GAME steps for 31 frame ends. The step does not run in the menus.

Headful boat (Xorg :0, Chrome 151, llvmpipe, no `/dev/dri`; the WebGL string
says "Intel UHD 620" but is faked on boats), cooperative backend, in-mission
cockpit with the clock running, 5 s samples: uncapped 5.3 / 4.9 GAME/s, present
cap 60 5.5 / 5.1, distinct frames equal to GAME/s each time. CPU-bound at ~5
steps/s; the cap never engages. The browser route is the CLI one sent through
the dev-server hub (`ctl.js -s ... cmd relmousemove/mousedown/...`) to a
`profile-web-frames.js --origin --guest-script=gate:...` page.
Evidence: `scratch/runs/20261010T2215Z-mw3-game-fps-boat-d10ba697`.

## Instant Action captions: FormatMessage va_list (fixed e027a9ca8)

The Instant Action screen showed "Commander: Đĺn", "Enemy: Đĺn" and
"Wave 122682568". Not a font problem: the captions come from Mech3Msg.dll
templates through `FormatMessageA(FROM_HMODULE, ..., Arguments)` with flags
`0x800` and `Arguments = &va_list` (return site `0x540b58`). Without
`FORMAT_MESSAGE_ARGUMENT_ARRAY` that parameter is a `va_list*`; our handlers
read it as the insert array, so `%1!d!` printed a stack address (0x074FFDC8)
and `%1!s!` the bytes there. Now "Commander: Bushwacker", "Enemy: Firefly /
Owens", "Wave 1". Evidence:
`scratch/runs/20261010T2225Z-mw3-instant-action-glyphs-d10ba697`.
