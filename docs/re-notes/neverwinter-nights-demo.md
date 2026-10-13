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
`glPopAttrib`. `glRasterPos2f` is also imported and currently unimplemented.

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

Remaining NWN blockers are real `glBitmap`/raster-position rendering, owned
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
