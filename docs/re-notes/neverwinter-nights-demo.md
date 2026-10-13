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
