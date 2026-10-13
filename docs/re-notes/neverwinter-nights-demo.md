# Neverwinter Nights demo: native display-list boundary

Source baseline: `6aaf65235`. Telegram request: saved #50. This investigation
does **not** establish a menu, rendered font, gameplay, audio, or performance.

## Fixture

Archive item `Neverwinternights001`, file `NWNDemo.zip`, 408857829 bytes,
SHA-1 `fd71deea70c7a4d6b6677893b0fed4738b4f5a0a`. A fresh remote download was
verified on 2026-10-13; it is a local compatibility fixture, not a distribution.

```sh
unzip NWNDemo.zip -d installer
unshield -d extracted x installer/NWNDemo/Demo/Disk1/data1.cab
mkdir game
cp -a extracted/HD0/. game/
for pair in Data:data TexturePacks:texturepacks Music:music Movies:movies \
    Miles:miles LocalVault:localvault Ambiant:ambient \
    override:override scripttemplates:scripttemplates nwm:nwm; do
  src=${pair%:*}; dst=${pair#*:}
  mkdir -p "game/$dst"
  cp -a "extracted/$src/." "game/$dst/"
done
```

`nwmain.exe` SHA-256:
`1c54767bac878459615fa7dc913e1dbdd80bbd70cf40d6249a7c8098fa95fd1f`.
Prepared remote game: `/home/user/nwn-fixture/game/` on `bx_gd476s95`.

## Exact first display lists

The executable's preferred image base is `0x00400000`; the following are
original guest VAs, not addresses in Wasm memory. OPENGL32 IAT starts at
`0x007f1214` (88 imports).

| Operation | IAT slot | Relevant callsites |
| --- | --- | --- |
| `glGenLists(128)` | `0x007f12a4` | `0x0070a90d`, `0x0070ac8b` |
| `glNewList(base + character, GL_COMPILE)` | `0x007f12a8` | register-indirect calls in loops at `0x0070a92e`, `0x0070acac` |
| `glBitmap(8,13,0,2,10,0,pixels)` | `0x007f12ac` | `0x0070a950`, `0x0070accf` |
| `glEndList()` | `0x007f12b0` | `0x0070a952`, `0x0070acd1` |
| `glDeleteLists(base,128)` | `0x007f129c` | `0x0070a99e` |
| `glListBase(base)` | `0x007f12d0` | `0x00708190` |
| `glCallLists(strlen(text),GL_UNSIGNED_BYTE,text)` | `0x007f1228` | `0x007081ab` |

The font loops cover characters 32 through 126, with 13 bytes per glyph starting
at guest `0x00859040`. `glPixelStorei(GL_UNPACK_ALIGNMENT,1)` precedes allocation.
The text helper surrounds ListBase/CallLists with `glPushAttrib(GL_LIST_BIT)` and
`glPopAttrib`. `glRasterPos2f` is also imported (implemented in the follow-up below).

This is a bitmap-font path. Returning a made-up list base or dropping recorded
commands cannot render it.

## Implemented bounded core

`src/09a8ca-gl-lists.wat` implements GenLists/NewList/EndList/CallList/DeleteLists/
IsList with nonzero contiguous reservations, reserved versus defined names,
replacement on EndList, owned scalar argument storage, COMPILE and
COMPILE_AND_EXECUTE, nested late-bound calls, deletion/reuse, a 64-level nesting
limit, context cleanup, and error reporting. Arbitrary explicit GLuint names
are supported; allocation size and range wrap are checked before allocation.
Empty reservation blocks and recorded commands are reclaimed.

Capture runs **before** the native matrix, software-renderer and attribute
observers. Replay re-enters the native encoder. A host-only implementation
would execute COMPILE side effects and miss native software state on playback.

The capture predicate deliberately supports a bounded scalar command set.
Queries and supported client-state commands execute immediately. Unhandled
recordable operations trap before observing or drawing; pointer arrays and
texture/image payloads are not retained as borrowed guest addresses. This is
not a claim of complete OpenGL display-list coverage. Existing native context
ownership is retained; transferring a context's list namespace between Wasm
thread instances and `wglShareLists` are not implemented by this change.

At the scalar-core checkpoint, remaining NWN blockers were real `glBitmap`/raster-position rendering, owned
bitmap capture with unpack-state semantics, ListBase/typed CallLists and
GL_LIST_BIT attribute restoration. They must work with both native software
rendering and the WebGL path. Unsupported entry points remain fail-fast.

## Validation and launch evidence

Remote evidence folder:
`/home/user/nwn-display-lists/scratch/runs/20261013T1138Z-nwn-list-audit/`.
Compact logs and `evidence.json` are copied to the coordinator's same run ID;
the full launch trace remains remote. The app is not registered in the
candidate manifest, so this is investigation evidence, not a gameplay result.

- Full `bash tools/build.sh`: PASS.
- `test/test-opengl-display-lists.js`: PASS, actual WAT storage/observer/replay,
  including a pointer-capture trap before mutation.
- Existing `test-opengl-wat-encoder.js`, `test-opengl-wat-worker.js`, and
  `test-gl-matrix-observer.js`: PASS.
- Negative control replacing only GenLists with constant `1`: rejected by
  disjoint-reservation assertion (`1 != 4`). Source restored afterwards.

Ordinary launch:

```sh
node test/run.js --exe=/home/user/nwn-fixture/game/nwmain.exe \
  --threads --vfs-include='**/*' --max-batches=45000
```

Matched baseline used `--no-build` and the baseline Wasm explicitly. Baseline
Wasm SHA-256 `d19c10b798cf71449551fa0387ce5e971c3c3c083aa47ca78f800a0fb7364d58`
traps at **glGenLists, batch 31905**. Candidate Wasm
`f1346e5e27b993e507465f8d4e686ae74aa4041d716c86a1677710aa7cf8b923` reaches
**glBitmap, batch 31905**, with the expected bitmap arguments and return
address `0x0070a952`. Neither launch reaches a menu or gameplay. The candidate
crash prevented the requested exit PNG; no screenshot was produced or reviewed.

## Bitmap-font follow-up (2026-10-13)

`src/09a8cb-gl-bitmap.wat` adds real `glRasterPos2f`, `glBitmap`, `glListBase`
and typed `glCallLists`. Raster position uses the native modelview/projection,
clip test, viewport and depth range; raster colour is captured and clamped at
RasterPos. Invalid raster positions neither draw nor advance. NULL bitmaps
advance valid raster positions without dereferencing pixels. Bitmap origins
use floor, rows start at the lower left, and zero bits leave pixels unchanged.

Compiled bitmaps own normalized pixel bytes, respecting unpack alignment,
row length, skipped rows/pixels and LSB-first. CallLists owns decoded offsets
for all ten GL encodings, resolves current definitions at playback, and uses
the current list base. GL_LIST_BIT and GL_CURRENT_BIT restore the native list
base and raster attributes. Bitmap commands replayed within Begin/End report
INVALID_OPERATION. This extends the scalar-list core rather than bypassing it.

The native software path sends bitmap fragments through the existing shared
span pipeline. WebGL receives a distinct window-pixel packed record and draws
one-pixel points with captured colour/depth, independent of the current object
matrices or point size. Its temporary full-drawable viewport/depth range are
restored afterwards. Tests verify scissor, alpha, depth and blending behavior.

The bounded implementation explicitly traps lit RasterPos and textured/fogged
bitmap draws (and an untrusted matrix mirror), rather than silently rendering
flat text. Other unimplemented list payloads, context transfer across Wasm
instances, and wglShareLists retain their earlier limitations. Existing broader
attribute-stack and renderer limitations are not claimed fixed here.

Semantic references: Khronos [glBitmap](https://raw.githubusercontent.com/KhronosGroup/OpenGL-Refpages/main/gl2.1/xhtml/glBitmap.xml),
[glRasterPos](https://raw.githubusercontent.com/KhronosGroup/OpenGL-Refpages/main/gl2.1/xhtml/glRasterPos.xml),
and [glCallLists](https://raw.githubusercontent.com/KhronosGroup/OpenGL-Refpages/main/gl2.1/xhtml/glCallLists.xml).

Evidence: `scratch/runs/20261013T1229Z-nwn-bitmap/` on the remote isolated
checkout, with a compact mirror in the coordinator checkout. Candidate Wasm
SHA-256: `e178ccc7815bacae5a16945b1ea77bd5a4defcc5ae2b9cde7144a8bf8c6b021e`.

- Full build: PASS.
- Actual-WAT `test-opengl-bitmap.js`: PASS. Owned pixels, compilation isolation,
  raster colour/position, clipped and NULL bitmaps, unpack state, all CallLists
  encodings, list-base/current-attribute restoration, deletion, alpha/scissor/
  depth, COMPILE_AND_EXECUTE, Begin/End rejection and unsupported-state traps.
- Real Chromium WebGL 1 and 2 `test-opengl-bitmap-webgl.js`: PASS. Pixel
  readback, viewport/depth-range restoration, scissor/alpha/depth/blend, no GL
  error. This tests the bitmap backend, not NWN's full browser launch.
- Existing list, encoder, Worker and matrix-observer regressions: PASS.
- Negative control replacing only native bitmap span writes with `nop`:
  rejected on `owned first source bit produces a fragment` (actual zero).
  Source restored; the candidate Wasm was never replaced by this control.

Ordinary fixture launch, with no gameplay input or fixture edits:

```sh
node test/run.js --no-build --exe=/home/user/nwn-fixture/game/nwmain.exe \
  --threads --vfs-include='**/*' --max-batches=250000 --max-seconds=60 \
  --quiet-api --quiet-blocks --png=scratch/runs/20261013T1229Z-nwn-bitmap/candidate-long.png
```

The prior glBitmap stop at batch 31905 is passed. A 60000-batch run completed
in 13.241 seconds with a plain gray capture. The longer run hit its 60-second
wall limit at 157588 batches, after creating four `NWN Movie Player Window`
windows, with no API trap. The final capture is plain black, 640x480. Main
guest EIP was `0x006fe749`, a return instruction in the small accessor at
`0x006fe740`; this alone does not identify the startup delay's cause.

Both captures were inspected. **No visible NWN font, menu, gameplay, audio,
or performance success is established.** Next investigation should locate the
movie/startup wait and the first actual presentation using bounded API/thread
tracing. Do not infer that an unimplemented display-list call is still the
current blocker, or that trap-free startup means the game works.

### Launch-route correction

Source inspection after the bitmap commit found that these two CLI launches
omitted both `--headless-gl` and `--gl-renderer=software`. The default WebGL
route therefore has no drawable and a reached `wglCreateContext` would fail (see
`test/run.js` beside HEADLESS_GL and createCanvas). Their gray/black captures
are **not evidence of a renderer or movie-playback defect**. The native and
Chromium pixel regressions above remain valid; original-game display-list
execution with a successful context still requires a qualified renderer run.
The next ordinary launch uses `--gl-renderer=software`, with the same fixture
and guest command line, to obtain a real native GL context without native GL
dependencies. No movies, assets or application rendering calls are bypassed.

## NULL pixel-format descriptor prevents context creation

The next measured software run (`20261013T1242Z-nwn-software/launch.log`)
selected a supported renderer but still issued no WGL context creation calls.
Its census showed attempted geometry and presents, with zero actual draws or
presents. A narrow API trace and original disassembly locate the cause:
NWN invokes `SetPixelFormat(hdc,1,NULL)` after successful ChoosePixelFormat
at `0x0070d41d` (hidden probe window) and `0x0070d93e` (main window). Our
`gdi_pixel_format_set` incorrectly reused ChoosePixelFormat's descriptor
validation, returning FALSE and making NWN skip the WGL setup branch.

Microsoft's [SetPixelFormat documentation](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-setpixelformat)
states that the descriptor affects metafile recording only; the format index
selects the actual format. The helper now validates the DC and supported index
and stores that indexed format, without interpreting the optional descriptor.
It still rejects invalid/deleted DCs and unsupported indexes and preserves the
selected format on rejected replacement. ChoosePixelFormat still validates its
request descriptor. The regression checks NULL and malformed ignored descriptors
plus GetPixelFormat state, invalid indexes/handles, repeat selection and cleanup.

Full build, the six-check GDI public-state regression, bitmap regression, and
WGL procedure-availability regression pass. Restoring just the old descriptor
guard is rejected by the NULL SetPixelFormat assertion. Candidate Wasm SHA-256:
`8f02ca6d0c0c4937dfcc768392daadaa44199665ecc4d1b365bf643e91e0ba99`.

The corrected ordinary software launch explicitly logs `wglMakeCurrent` with
real context handles 1 (probe window) and 2 (main window), at batch 31921. The
first 95 bitmap calls at `0x0070a952` occur before these contexts are created:
they are not evidence of successful original-game display-list definitions.
This measured NULL-descriptor gate supersedes the earlier untested inference
that the default no-drawable route alone explained NWN's black capture.

The fixed-PFD software run completed 114612 batches in 60 seconds without an
API trap. GL census: 291300 packed draws, 3949944 vertices, 12704 actual
presents, 82 texture uploads, zero unsupported texture uploads, target and
drawable both 800x600, trusted matrix mirror. Its inspected `fixed-pfd.png`
is still black. Native counters report zero rasterized triangles and 1316648
culled triangles (exactly vertices/3): the next rendering investigation is
geometry winding/projection and culling state. Do not disable culling merely
to manufacture a visible success. No NWN menu/gameplay/font proof yet.


## Projection-input diagnostic after the PFD fix

The unchanged `91239ef29` Wasm was probed using a read-only wrapper around
`OpenGLHostBridge.call` and the existing GL trace hook. Artifact folder:
`scratch/runs/20261013T1300Z-nwn-cull/`. The inspected 800x600 image is black.
The 60-second probe completed normally: 261998 packed draws, 3552456 vertices,
11430 presents, and 1184152 culled triangles, with zero rasterized triangles.
Native scratch samples show all three projected vertices at `(0,600)` and
signed area zero. The fallback viewport is correctly `(0,0,800,600)`.
The MVP scales are approximately `2.64116e-5` and `1.80040e-7`, translating
almost to `(-1,-1)`. Scratch is the last native draw before host command drain;
it must not be paired as an exact draw with the wrapper's logged packed record.

The separate first-150-matrix-call trace identifies the upstream input:
`glOrtho(0,75724.28775014915,0,10703612,81.91999816894531,757.760009765625)`;
the next projection has right `75724.28674300201` and top `11108614`.
`glScalef(1,1,1)` and an identity `glMultMatrixf` follow. These enormous
projection extents explain the tiny MVP and collapsed geometry; changing the
culling sign or disabling culling would not correct their cause. This does not
yet prove a floating-point interpreter defect: guest field initialization and
argument generation remain to be traced.

Static PE import analysis finds `glOrtho` at IAT `0x7f12d4`, with direct calls
at `0x550eb6`, `0x59ff51`, `0x70aac2`, `0x70adce`, and `0x7382f0`.
The last caller constructs `(0, aspect * [esi+0x1c4], 0, [esi+0x1c4],
[esi+0x1c8], far)` using x87 loads/stores. Its shape matches the captured
projection, but the live return address/object values have not yet been
measured. Next diagnostic: capture the caller and these fields before the
x87 conversions. No rendering override, source fix, or gameplay claim was
made from this diagnostic.

Two existing-harness caller breakpoint attempts were inconclusive: immediate
`--trace-at=0x7382b9,0x7382f0` ran 180000 batches in 1.313 seconds; delaying
arming to batch80000 ran 400000 batches in 2.756 seconds. Both ended at the
batch limit without a trace hit, with worker T1 recording zero slices. This
trace route changes startup scheduling; neither run measures the object
fields or qualifies the proposed caller. Logs are preserved in the same
artifact folder. A next probe should first capture the queued call return
address without guest breakpoints, then use a scheduling-compatible probe.

## Software viewport query leaves projection inputs uninitialized

The read-only command probe in `20261013T1920Z-nwn-projection` resolves the
upstream cause without breakpoints or a floating-point change. Original guest
code at `0x737e84` calls `glGetIntegerv(GL_VIEWPORT, stack + 0x60)`. When its
explicit viewport fields are zero, it converts the returned height and width
with FILD at `0x737e9e`/`0x737ea2`, computes their ratio, and stores height times
0.01 in `[esi+0x1c4]` at `0x737f0c`. That feeds the previously identified
orthographic projection call.

The software backend returned scalar zero for GL_VIEWPORT, so the bridge wrote
only the first output word. A live baseline query with captured return address
`0x737e8a` changed `[8316827,0,7572429,1044885012]` into
`[0,0,7572429,1044885012]`. The following captured glOrtho return address is
`0x7382f6`, with right about 75724.29 and top 10448850. These are stale stack
values being converted correctly by x87, not evidence of an FPU defect.

The software backend now maintains a four-component viewport per context,
initially covering its drawable, and answers GL_VIEWPORT with all four values.
Valid glViewport calls update it; negative dimensions preserve it and report
GL_INVALID_VALUE. This follows the viewport initial state and query shape in
the [OpenGL specification](https://registry.khronos.org/OpenGL/specs/gl/glspec121.pdf).
The candidate live query writes `[0,0,800,600]`, and the same guest caller now
passes `glOrtho(0,8.000000238418579,0,6,81.91999816894531,757.760009765625)`.
No geometry, culling, guest code, or fixture override is involved.

The actual bridge regression fills the destination with sentinels and checks
all four values and both adjacent guard words, initial size, signed offsets,
negative-size error/state preservation, zero-size viewports, and context
isolation. Old source fails with three sentinels untouched. The six-check
drawable test and fixed-function, frame-state, and command-stream regressions
pass. The canonical build passes and its Wasm remains
`8f02ca6d0c0c4937dfcc768392daadaa44199665ecc4d1b365bf643e91e0ba99`;
this correction is entirely in the host JavaScript.

The matched ordinary Threads/software launches use the unchanged, hash-verified
fixture, a 45-second guest run limit and a 65-second external deadline. The
baseline reaches 97438 batches and its inspected 800x600 capture is black.
The candidate exits normally with status 0 after 76631 batches and shows the
actual Neverwinter Nights main menu: artwork plus readable New, Load,
Multiplayer, Movies, Options, and Exit labels. This establishes menu rendering,
not new-game progression, gameplay, audio correctness, or rendering perfection.
The baseline Boat command's 30-second transport deadline killed its waiting
supervisor, but its externally bounded child completed the 45-second run and
wrote the capture; its process exit code was therefore not collected. The
candidate uses a detached supervisor and preserves the actual exit status.


## Ordinary Prelude route after the client stack fix (2026-10-13)

The earlier ordinary route at `7b3449c4` reached New → Select Premade
Character → Aluvian Darkstar → Loading Area, then trapped at
`glPushClientAttrib(GL_CLIENT_VERTEX_ARRAY_BIT=2)`, batch 192852,
call `0x71afb4`, return `0x71afba`. Evidence is
`scratch/runs/20261013T2010Z-nwn-gameplay/` (the run actually started 19:33Z;
the directory timestamp is just its historical ID).

The follow-up tests exact source `95457854dc818389f67c58373aef4c81133be3b5`
with an empty tracked diff. Its canonical Wasm was copied from the separately
validated client-stack checkout and verified as SHA-256
`79a828167326142433105270a3cd53fe33a3ce934f71116451e8948315b44c93`.
The original complete fixture is reused at `/home/user/nwn-fixture/game` on
`bx_yqnspudj`, with the same executable hash recorded above. No guest or asset
patches, source probes, or rendering overrides were applied.

```sh
# cwd: isolated /home/user/nwn-prelude-work, exact source 95457854
# external timeout: 210 seconds, TERM then KILL after 5 seconds
node test/run.js --no-build --exe=/home/user/nwn-fixture/game/nwmain.exe \
  --threads --vfs-include='**/*' --gl-renderer=software \
  --max-batches=500000 --max-seconds=180 --quiet-api --quiet-blocks \
  --control=8125 --png=scratch/runs/20261013T1948Z-nwn-prelude/final.png
```

Frozen-control tools were used against the continuously running CLI, with no
explicit tracing enabled. Node was v24.18.1, Linux x86-64; software drawable
800x600 and control capture 640x480. Default guest clock was 200ms per batch,
so this is compatibility evidence, not real-time performance evidence.
The recorded inputs were click `(320,183)` at batch 78260; clicks `(400,230)`
and `(320,183)` at 87494/87502; clicks `(320,252)` at 91033/129618;
and double-click `(130,75)` at 161183. Initial captures after the first New
and premade clicks still showed the previous screen; repeated ordinary input
then advanced. Input-delivery timing has not been separately diagnosed.

Reviewed captures show the main menu, character-choice dialog, Aluvian
Darkstar's character list/portrait, a black transition, and Loading Area at
roughly 80 percent at batches 204104 and 225389. The run passed the previous
client-stack stop and then failed at **`glStencilMask(0xff)`**, batch 248943:
original call `0x715182`, return `0x715184`, IAT `0x7f1264`, block EIP
`0x715177`. The unchanged fail-fast handler terminated with exit code 1 before
the wall deadline. Final exit PNG was not emitted after the trap.

Evidence `scratch/runs/20261013T1948Z-nwn-prelude/` contains the exact command,
supervisor, source-file hashes, provenance, controls, screenshots, log and
status, mirrored locally with per-artifact SHA-256 in `evidence.json`.
The app remains an unregistered investigation fixture, so no unrelated
candidate dashboard record is fabricated. **No world frame, movement,
combat, audio or browser gameplay is established.** The next implementation
boundary is real stencil-mask semantics and the renderer's stencil support;
returning success without those semantics would hide the blocker.
