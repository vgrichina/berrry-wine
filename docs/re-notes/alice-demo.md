# American McGee's Alice demo

## Original-media preflight (2026-10-09)

Original: `test/binaries/win98-games-a-d/american McGees-alice_demo-OpenGL.exe`,
82,499,584 bytes, SHA256
`ce873bf2525041a624c1a5a27b513f135b51ffdbeae9f68a6ede3edd8c7078e6`.
7-Zip recognizes its WinZip self-extractor: 15 files, two directories,
85,622,092 uncompressed bytes. It contains `alice.exe`, `demo/cgamex86.dll`,
`demo/fgamex86.dll`, `demo/pak0.pk3`, and Miles sound drivers. The included
readme identifies the November 27, 2000 demo. No installer execution is needed
to obtain these original files.

No Alice/McGee registration, task, or gameplay run directory was found in the
current registry, TODOS, board, and retained run-name search. This is a queued
new-game candidate; no launch or gameplay is claimed. BW2 remains compatibility
coverage rather than being counted as another previously unqualified title.

Static import audit reports 212 imports in `alice.exe`, including five missing
API-table rows: `midiInStart`, `midiInOpen`, `midiInGetDevCapsA`,
`midiInGetNumDevs`, and `midiInClose`. Each gameplay DLL has 77 imports and no
missing/explicit fail-fast handler reported. Static imports do not establish
that these functions execute; do not add silent stubs based on this scan.
Dynamic OpenGL/Miles lookup and actual runtime behavior remain untested.

Preflight hashes, small extracted executables/readme, and import report:
`scratch/alice-preflight-20261009/`. Original archive transfer to temporary
`bx_75agndxm:/tmp/alice-original.exe` completed at 04:27:39Z with matching SHA256;
`transfer.json` is the completion receipt. The first extraction attempt could
not start because this no-env box has no `7z`; its failure log is preserved.
Using installed `unzip`, all 15 files were extracted to
`/home/user/alice-original-v2-20261009`, with exact expected total size and
successful archive CRC test. Preparation PID251100 finished at 04:28:27Z.
All 13 PE modules were audited; only the five MIDI imports above were reported.
Exact file hashes, CRC output and full audit are the local `remote-v2-*` receipts.

Original code registers `in_midi` with default string `0` at `0046acf0`.
Initialization at `0046b460` reads it, compares with zero, and returns via
`0046b51d` before `midiInGetNumDevs` when zero. This supports optional MIDI
startup as a static inference; no handler or config was changed, and runtime
reachability is still unverified. See `midi-static-route.json`.

Prepared `/tmp/alice-probe-launch.js` refuses to run while BW2 browser189048
or Disciples handoff controller234050 is alive. It has a 180-second outer guard,
mounts original `demo/**/*`, `snddrivers/**/*`, and `readme.txt`, and captures
the first visible window without inputs. It is uploaded and syntax checked,
not executed. No missing archive paths are known. Next: ordinary launch after
the serialized current work, then New Game/skill selection and W/S movement
as described by the original readme. Do not start a parallel guest or browser.

## 2026-10-09 original initialization: texture border API

Initial-console probe ended normally. Continuing original initialization (same bb9d6e96 module, cooperative CLI, all14 support mounts) creates American McGee's Alice window, then fails at batch123 in glTexParameterfv. Arguments are target0xDE1, pname0x1004 (texture border color), pointer074ff41c to four float1 values; return00484cf3. Source api_table row4442 still maps gl_unimplemented. This is the next concrete runtime blocker, not the five statically missing MIDI-input imports. Do not replace it with a success stub: support actual texture state and sampling/queries across the relevant backends, with a control-failing regression and original launch validation.

Self-contained control: scratch/runs/20261009T0509Z-alice-gl-texparameter-crash (7artifacts; last image precedes the crash). Probe270020 and guest270030 exited1 at05:09:03.423Z. The preceding API transport409 was a transient boat update; original run started only after authoritative boat state recovered.

## Border-sampling control (2026-10-09 07:35Z)

Synthetic regression on unchanged main runtime f1fb7fbe157c1ed6a85b926a31678fb7e0b11299fdfa9c363c2ce41a35a6b418:
run20261009T0735Z-alice-border-control. Remote controller62994 terminal1 at
07:35:15.041Z. Existing software-raster harness draws a two-texel RGB blue/yellow
image with constant coordinates to eliminate LOD/interpolation ambiguity.
CLAMP_TO_EDGE at s0/t0.5 and GL_CLAMP at interior s0.25/t0.5 both pass full-blue
controls. GL_CLAMP at s0/t0.5 fails: RGB0000ff instead of half-blue00007f/000080.
The following quarter-blue corner assertion is retained but was not reached.
This proves an actual sampling gap independently of the missing vector API.

Specification reference: [OpenGL 2.1 texture sampling](https://registry.khronos.org/OpenGL/specs/gl/glspec21.pdf).
GL_CLAMP clamps coordinates before filtering; it does not replace outside
filter taps with edge texels. Border values supply those taps. Thus a bilinear
sample on one edge includes half border; a corner includes three border taps.

Concrete source boundaries:
- lib/gl-compat.js texParameter maps CLAMP to CLAMP_TO_EDGE; fragment shader
  uses hardware texture2D for both units. Proper border behavior needs filter/LOD
  handling, not only a saved color or a uniform mixed at arbitrary distance.
- src/09a8g-gl-raster.wat has8-byte slots (surface/flags),4096 names; flags collapse
  CLAMP and CLAMP_TO_EDGE. gl_sw_r_address emits D3D address1/3 only.
- src/09ab-handlers-d3dim-core.wat d3dim_texture_sample_prepared supports
  wrap/mirror/clamp; its signature has no border color. Do not read outside the
  texture backing when adding missing filter taps, or use unsnapshotted shared state.
- GL Worker snapshots currently have resolved texture flags at1024/1028 and
  fixed1032-byte state /1040-byte descriptor. Any added border state must be
  preserved for queued draws and both texture units; metadata offsets are an ABI.
- GL CALL_INDEX and command ARG_WORDS additions must append; vector pointer
  payload must be copied at submission. API row4442 already exists, so replace
  its handler only when real behavior exists; do not renumber API IDs.

Next implementation: per-texture clamped RGBA state and real filter-tap border
handling, query/setter validation, immutable queued-state coverage, native/WebGL
pixel tests, then unmodified original Alice startup. Existing scratch control.js
is a full retained runnable regression; copy into remote test/ alongside render-helper.
Fresh worker spawn still fails thread limit; root direct, one runtime budget.

## Software sampler foundation (2026-10-09 07:41Z)

Added gl_sw_border_tap/gl_sw_border_sample with explicit immutable color and
independent GL wrap enums. Missing taps return the supplied color before any
backing read. GL_CLAMP clamps coordinates before filtering; CLAMP_TO_BORDER
permits all-border footprints; EDGE/REPEAT retain distinct behavior. No mutable
sampler globals or modifications to the existing D3D hot sampler.
Existing test-gl-software-raster exports this helper only through extraWat and
checks actual Wasm pixels, including an invalid backing pointer for an outside
nearest tap. Canonical build and gl-software-raster, d3dim-texture-wrap,
opengl-fixed-function suites pass on temporary box; controller65306 terminal0
at07:41:31.123Z. Module b2552fac1043910e48cd00a672581dd9235792ba199d7f7943a7f14ba587637d.
Evidence run20261009T0741Z-alice-border-sampler retains source/test/scripts/logs.
This is infrastructure only: production GL draw calls still use the old sampler,
so the earlier end-to-end CLAMP regression and Alice vector API remain unresolved.
Next wire per-texture RGBA/wrap state through resolved draw/Worker snapshots,
route both GL texture units through the helper, then complete WebGL and API replay.

## Production default-border routing (2026-10-09 07:55Z)

Both software texture units now retain GL_CLAMP separately from CLAMP_TO_EDGE
in texture flags (bits128/256), including existing immutable Worker snapshots.
The shared raster interface carries GL_CLAMP as an explicit tag; D3D address
modes retain the original sampler. The 16-bit wrap fast path excludes this tag.
Default border alpha is opaque for RGB internal formats and zero for RGBA.
Real draw tests pass half-border edge/quarter-border corner pixels; unit1 also
checks RGBA alpha and clearing border mode when switching to CLAMP_TO_EDGE.

Canonical build and GL software, D3DIM wrap, GL fixed-function, multitexture,
and GL Worker transport suites passed; controller69442 terminal0 at07:49:46Z.
Additional unit1 regression passed07:55:13Z. Run
`20261009T0749Z-alice-border-routing` retains logs/source/tests with hashes.
Module5b2cfa1d20224e856ecc28f1de76767ccfcaa1740f6d49e254dcf3d7e296349e.
Connection502 observation failures did not mean test failure or require a rerun.

Still incomplete: programmable per-texture border RGBA and queries/validation,
vector API payload/replay, WebGL sampling, and queued-border pixel isolation.
The existing Worker transport test is not a queued-border pixel test. Original
Alice still hits its unimplemented vector setter; no new game screenshot claimed.

## Per-texture color and queued replay (2026-10-09 08:00Z)

Internal software state now keeps clamped float RGBA per texture in a lazily
allocated 65536-byte table; deletion clears the color. Sampling quantizes only
when resolving the draw and applies RGB's opaque alpha. Both units capture
their packed colors at snapshot offsets1032/1036; snapshot length is now1040,
with the existing descriptor still at1040 within the1056-byte allocation.
This preserves floating-point values for future queries and avoids shared
mutable color reads during queued rendering. Allocation failure returns failure
to the caller; the future guest setter must turn that into GL_OUT_OF_MEMORY.

Canonical build/five suites pass, controller74266 terminal0 at08:00:02Z.
Extended multitexture regression passes08:00:34Z: float clamping, independent
objects, green border pixels, delete reset, and two queued quads retaining red
and blue borders after a later green setter. It copies real submitted records
then replays through gl_sw_worker_draw deliberately later, in one instance;
this proves snapshot isolation, not concurrent scheduling. Run
`20261009T0800Z-alice-border-state` contains tests/sources/logs and hashes.
Module47ab13a8479754405556464cd97d606e17a08b57f25b1b5d8ecb89415a3ba095.

Guest glTexParameterfv is still fail-fast. Next connect validated pointer-copy
submission, matching JS state/query handling and correct WebGL filtering, then
enable the API and rerun original Alice. Do not treat the helper as API support.

## Frontend state and validation (2026-10-09 08:08Z)

JS keeps per-object border floats and original wrap enums separately from the
hardware CLAMP_TO_EDGE alias. Internal query helpers return detached values;
delete/reuse resets state, units retain independent objects, and pending draws
flush before changes. Scalar setters reject invalid target/filter/wrap values;
the WAT mirror likewise preserves old sampling flags for invalid enum values.
Tests cover unchanged pixels after invalid MAG/MIN/wrap, object isolation,
clamping, detached queries and pending-draw ordering. Canonical build/five suites
pass, controller77481 terminal0 at08:07:44Z, run
`20261009T0808Z-alice-border-frontend`, module
970c8abc76a0c66167152f9ec432417d9f643208cc2f77c960852c00274aab04.

WebGL shader work remains. Backend defaults to WebGL1; do not silently implement
only WebGL2. Existing D3D9 mip-atlas lowering supports explicit border taps but
is not directly reusable without atlas uploads and GL-specific clamp semantics.
Another candidate is explicit-LOD center-tap sampling with EXT_shader_texture_lod
and derivatives (core equivalents in WebGL2), manually combining missing taps.
Check extension availability and real pixel behavior before selecting that route.
Do not approximate border weights using only base-level dimensions under mipmaps.

[OpenGL2.1 specification](https://registry.khronos.org/OpenGL/specs/gl/glspec21.pdf),
sections3.8.8-3.8.10, defines per-level filtering and the min/mag switch: threshold
0.5 for LINEAR magnification with either NEAREST_MIPMAP filter, otherwise0.
Incomplete mipmapped textures disable texture application for the unit. Native
software mip policy is currently approximate; do not claim complete GL conformance.
Guest vector dispatch, pointer replay and real shader support are still pending.

## WebGL border pixels (2026-10-09 08:14Z)

The frontend now selects a border shader for GL_CLAMP draws. Explicit-LOD
texel-center taps reconstruct nearest/linear filtering at each selected mip,
returning the object's border for missing taps, then combine levels for trilinear
filtering. Both units carry independent size/filter/wrap/color uniforms. Ordinary
draws keep the original shader; returning to it replays its uniforms. The WAT
software frontend bypasses GPU shader selection entirely.

WebGL1 requires OES_standard_derivatives and EXT_shader_texture_lod; WebGL2 uses
their core equivalents through the existing shader conversion. Missing extensions
fail explicitly; headless desktop-GL extension compatibility is not verified.
Image metadata tracks mip completeness; incomplete mipmapped textures disable the
unit in the border path, and generated mip chains populate the same metadata.

`test/test-gl-border-web.js` passed16 real Chrome/SwiftShader pixel assertions,
eight each for WebGL1/2: edge, corner, nearest, switching to normal shader,
incomplete mip chain, mip1, trilinear and independent unit1 green border.
Controller81241 terminal0 at08:13:59Z. Final run
`20261009T0813Z-alice-webgl-border` retains source/test/identity/readPixels results;
gl-compat SHA a450290cf8b7eb85a01396948c279c239d3e16df17d2607600b812736efef9bf.
Its pixels.png is blank after backend destruction and is not visual evidence;
the assertions read actual GL pixels before teardown. No game screenshot claimed.
Prior14-case run0811 retained but its intermediate JS source was not retained.
Fixed-function JS regression, test-tier and browser cache checks also pass.

Still required: guest vector API/query dispatch, command payload copying and
original Alice validation. No performance qualification or universal GL format
conformance claim. Temporary runtime moved to bx_bufemdmn (expires09:14:52Z);
old bx_kbtxb6tb stopped after all browser/native probes were terminal.

Final tracked browser test reran on bx_bufemdmn after restoring npm dependencies
(fork omitted node_modules). Run `20261009T0818Z-alice-webgl-border` records
controller20725/Chrome20740 terminal0 at08:17:21Z and all16 cases passing with
the same verified gl-compat SHA. Copying the context canvas still produced a
blank screenshot: the backend renders to an offscreen framebuffer. Pixel checks
read that bound framebuffer correctly. The capture now reads the full framebuffer
before teardown instead of the default canvas; final capture verification follows.
Earlier new-box attempt failed before launch because Puppeteer was absent.

Final framebuffer-capture run `20261009T0819Z-alice-webgl-border` also passes16
cases with the identical renderer SHA. Controller21418/Chrome21433 terminal0
at08:18:28Z. Reviewed pixels.png now shows the two green-tinted synthetic test
canvases; no game screenshot/playability credit. The test is in the e2e tier.

## Vector API and copied replay (2026-10-09 08:27Z)

Appended GL command112 glTexParameterfv and113 glGetTexParameterfv; existing
API table IDs4442/4299 stay in place. Vector arguments are copied at submission
(16 bytes for border,4 for scalar properties), after target/pname validation.
The software observer gathers sparse guest pages separately and stores the color;
allocation failure is carried in the record as GL_OUT_OF_MEMORY so host state
does not falsely update. Float queries are barriers and do not write on invalid
enums. glGetError now consumes frontend errors before querying the backend.
Priority remains a per-object float residency hint; objects remain backed for
their lifetime. Integer-vector setter/query aliases remain fail-fast.

Build/seven suites passed, controller25378 terminal0 at08:26:46Z. Extra sparse
regression passed08:27:23Z: a16-byte vector straddles nonadjacent backing pages,
native state sees all four values, and replay retains them after guest mutation.
Run `20261009T0827Z-alice-border-api` retains source/generated files/test logs;
module b9c7ab4b7c5acfd2cb72f7ec953889fc32cf162aa02e3f5ca1545e515e2a16d9.

Original Alice rerun27159/27166 stopped before guest execution because the new
fork omitted `/home/user/bw2-normal-route-20261009/test/binaries/tlbs/stdole2.tlb`.
Restored the15088-byte support file, SHA
db456130e4b131aff27a6a3179464a28c9452f06eb6f2081d2aea38128d31895.
Fresh original-media run27878 is underway with300s guard and no input; do not
interpret the missing-file attempt as a guest regression or gameplay evidence.

## Next original-demo failure (2026-10-09 08:30Z)

Original Alice now passes glTexParameterfv (trace return00484cf3), creates its
640x480 game window, and reaches batch1094 before failing at
wglSwapIntervalEXT(0), return00487191. Run
`20261009T0830Z-alice-swap-interval-crash` retains17 artifacts with hashes;
27878/27885 terminal1 at08:30:28Z. Checkpoint9 is gray, not a menu or gameplay.
Missing-typelib attempt is retained separately in0828 run. No input was issued.

The WGL resolver currently looks up any api_table entry, including aliases to
gl_unimplemented, and advertises a thunk for wglSwapIntervalEXT despite having
no implementation. Its comment claims it exposes only implemented APIs, which
the code does not enforce. Next investigate correct generic procedure availability
(supported extensions must remain resolvable, unsupported/non-GL names must not
be advertised), or implement actual swap pacing. Do not add a successful no-op
setter or change guest configuration. Direct unsupported API calls must remain
fail-fast. Texture implementation3270207c7 is already pushed to main.

## WGL availability and next frame-end failure (2026-10-09 08:40Z)

The global API table contains unsupported aliases and unrelated Win32 names.
wglGetProcAddress previously returned thunks for all of them. The generated
availability predicate now derives from the actual GL/WGL dispatcher map,
excluding GLU. Unsupported direct calls still fail fast. Current-context
lifecycle behavior is unchanged by this scoped correction.

Unchanged native control returns118489088 for wglSwapIntervalEXT; candidate
returnsNULL, rejects non-GL/GLU/unknown/case-mismatched names, and preserves
correct thunk identities for ARB_multitexture and vector texture APIs. Canonical
build plus resolver, multitexture and generic encoder suites pass.
Run20261009T0839Z-alice-wgl-availability retains sources/logs; module
6f11700188244b00d25595743c7ceeaffcabe98769e166d3cd34eb3214c55246.

Original unchanged demo no longer traps at swap-control lookup. It reaches
frame end, then shuts down GL and displays GLimp_EndFrame() - SwapBuffers()
failed! in its console. Reviewed checkpoint19, run
20261009T0840Z-alice-swapbuffers-error;32814/32821 terminal08:39:46Z.
Next trace the real SwapBuffers/presentation return and context ownership.
No menu/gameplay/FPS/audio claim or guest configuration change.

Final predicate also preserves three native handlers outside the GPU opcode map:
wglGetCurrentContext, wglGetCurrentDC and wglSwapLayerBuffers. Extended native
tests and canonical build pass, run20261009T0842Z-alice-wgl-final,34093 terminal
08:41:52Z; final module65f1f98d4b3545f5141b0be2816e1c9353729dbfa477013fc4baafa3b95ae1a4.
Original final-module replay confirms same SwapBuffers error: actually the
wglSwapBuffers spelling, HDC00310011, return004871c1, API621598.
Run20261009T0842Z-alice-swapbuffers-final reviewed;34958/34965 terminal08:42:06Z.

## Correction: CLI graphics provider, not SwapBuffers defect (08:48Z)

The previous original-game controllers omitted both a headless WebGL provider
and --gl-renderer=software. They attempted wglCreateContext but never made a
context current. Existing --trace-gl plus --trace-host proves gpuPresent is
received without a context; the later host return1 is wglMakeCurrent(NULL,NULL)
cleanup, not successful presentation. Runs0844/0845/0846 retain diagnostic logs.
The --trace-at return breakpoint emitted no register evidence in stepped mode.
A direct native-handler control with host success returns1 correctly.

Correcting the test host to --gl-renderer=software, with the same original
media and module65f1f98d, makes a real current context and renders the animated
EA intro. Run20261009T0847Z-alice-software-startup checkpoint11 reviewed;
37914/37921 terminal08:47:43Z. The guest swap-control availability fix remains
real; the subsequent SwapBuffers failure must not be tracked as an emulator
defect. Menu/player-controlled gameplay is the next validation, not a stub.

Menu run20261009T0853Z-alice-menu completed normally at08:53:14Z,
38759/38777 terminal0. Forty-four original artifacts plus controller and hashes
retained; checkpoint14 reviewed/photo969. Ordinary-input follow-up uses a
bounded600s controller with recorded request/response files, same module/media
and software backend. No guest configuration or memory changes.

## New Game loading: allocation tail guard (08:58Z)

Ordinary Enter at the reviewed New Game menu opens difficulty. Enter selects
Easy; loading then returns to the console with Z_Free: memory block wrote past
end. Run20261009T0856Z-alice-new-game-heap-error retains22 original artifacts
plus controller/hashes; screenshots ready,step2,step5 reviewed. Controller
41655/41662 terminal08:56:37Z. No gameplay claim.

Original Z_Free is00444eb0. User pointer becomes ESI-16; header+12 and tail
[header+size-4] must equal000facc2. Failure message at00513314, tail compare
00444ee6, error push00444ef0, Com_Error call00444ef7. Header guard passes;
tail guard fails. This identifies the check, not the overwriter. No evidence
yet linking the separately known VirtualFree decommit bug. Native disassembly
retained with the diagnostic work. Next built-in --trace-at=00444ef0 with
--trace-at-mem=esi:64,esp:64 on a plain CLI run, repeating the ordinary inputs.

## Heap writer captured (09:04Z)

Plain CLI replay with ordinary inputs reproduces the guard at batch3079,
00444ef0. ESI(header)=084909e0, EAX(size)=00f3f2b8. Header dwords are
00f3f2b8,00f3f2b8,084909e0,000facc2; computed tail is zero.
Run20261009T0900Z-alice-heap-guard-trace,44769 terminal09:00:47Z.

Watch replay arms header084909e0 at batch1650. At1672 it becomes00000030.
At3022 CRT free-list insertion004ed3d6 writes00f3f2b8 via [EDX+4],
EDX=084909dc; predecessor004ed3cd, observed next EIP004ed3f3.
EBP074fc888, ESP074fc868; frame-pointer caller004e8359. More free-list
changes follow during cleanup. Original Z_Free guard message is reproduced
in this same watch run, although combined trace-at does not emit its register
dump. Run20261009T0904Z-alice-heap-header-watch retains log/disassembly;46707
terminal0 at09:04:42Z. This is CRT freeing/coalescing behavior, not a proven
VirtualFree decommit overwrite. Next recover the free argument/caller and
allocation lifetime to distinguish premature free from an overlapping block.

Original fgamex86.dll preferred10000000, loaded02940000; cgamex86.dll
preferred30000000, loaded03077000. The original files are in demo/ beside
pak0.pk3 in the retained installed tree on the temporary boat.

## Free-origin probe fidelity (21:02Z)

A replay with instruction-interior trace004ed3d6 reproduces the guard but emits no trace (run20261009T2055Z-alice-free-origin-no-hit). Known block start004ed3cd emits records, but that replay stops during a different startup route before its batch cap, with no target pointer (run20261009T2056Z-alice-free-origin-head). No config files were found in the original installed tree; do not infer a saved-setting cause.

Added optional --watch-stack to the primary watchpoint report. Syntax check and original run20261009T2101Z-alice-watch-stack verify32 stack dwords print. This filtered watch without the original trace breakpoint samples PC0044be18 after the target value changes, not the earlier CRT writer; that stack cannot prove the free caller. Next restore the exact original watch+trace flags with only --watch-stack added. PID40779 is bounded240s on bx_5jcbe4c6. No guest fix or gameplay claim.

## Actual free caller recovered (21:04Z)

Run20261009T2104Z-alice-free-caller restores original watch+trace flags, adding only stack output. It reproduces precise writer004ed3cd/004ed3f3, EDX084909dc, batch3022. Stack074fc89c=00444f1d and074fc8a0=084909e0 proves Z_Free called CRT free on that header. Next return00444f56 belongs to tag-list cleanup00444f30; caller00454464 supplies tag4. This is an intentional original-game free, not evidence that CRT corrupted a live block spontaneously. Controller40779 terminal0 at21:04:42Z.

Prior guard run0900 already supplies later return029b706b and argument084909f0. With fgame load02940000/preferred10000000, this is original1007706b: wrapper10077040 subtracts4 from its own pointer, updates allocation counters, then calls imported function101cd280. It reaches Z_Free on the already-freed user pointer. Static tag cleanup walks next pointers and removes nodes; investigate stale lifetime or an earlier initialization error that initiates cleanup before diagnosing allocator corruption.

Next probe captures Com_Error438ad0 entry and stack, to recover the first error rather than only the final guard message.20640 active on bx_42ztf6q5,240s bounded. Old boat stopped after terminal runtime; replacement fork omitted build outputs. Canonical rebuild19873 terminal0 at21:08:23Z reproduces exact527004d9 hash, run20261009T2108Z-alice-fork-build. No new gameplay claim.

## Central error trace: no earlier error observed

Fork preparation failures are separate harness evidence: run20261009T2109Z-alice-first-error-harness lacked test/binaries/tlbs/stdole2.tlb; run20261009T2110Z-alice-first-error-renderer-missing lacked pngjs and consequently GDI canvas/SwapBuffers. Both returned exit0 despite errors and are not passes. Restored exact15088-byte stdole2.tlb SHA256db456130e4b131aff27a6a3179464a28c9452f06eb6f2081d2aea38128d31895; npm ci --ignore-scripts --omit=optional restored pngjs/wabt/puppeteer (21737 terminal0 at21:10:51Z).

Corrected run20261009T2113Z-alice-first-error traces438ad0 from startup: one observed call, batch3079, return00444efc, code0, message00513314 (Z_Free tail guard). No preceding central error was captured.22153 terminal0 at21:13:09Z. Earlier-load-error explanation is unsupported by this trace; next identify normal function containing00454464 and why fgame retains a tag4 allocation after its cleanup. Do not skip the guard or alter guest configuration.
