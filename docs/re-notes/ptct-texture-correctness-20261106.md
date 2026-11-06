# PTCT texture and animated-scene investigation — 2026-11-06

The original issues texture operations, but the observed beam sequence renders
without texturing. The new failure boundary is earlier: its sole observed
texture allocation/upload attempt reaches our GL bridge before any context
exists. This establishes neither an intentional wholly procedural intro nor an
emulator texture defect. No emulator repair is justified by this evidence.
The next investigation should establish why initialization reaches GL before
context creation, including original initialization/callback ordering. Complete
intro correctness and Windows-reference parity remain unverified.

## Original and retained history

Fixture `test/binaries/demoscene/ptct/PTCT.exe` is 74,752 bytes, verified SHA-256
`89028685eb2968dcc9a9dd6b7941e4fad47a70e505820dc1be350a0d30526cc4`.
The registered `ptct` launch uses resolution chooser command 1;
`tools/site-app-shots.json` retains
`--input=1:wait-dlg-control:1:5000,2:dlg-cmd:1`. The original launch was used
without guest patches, forced GL state or replacement media.

The October 30 paired-browser section in `docs/gl-d3d-corpus-status.md` establishes
changing gray/white beams, not complete intro correctness or same-frame parity.
Its `20261030T2351Z-ptct-paired-browser` run remains absent locally after searching
retained evidence and recipes. I personally inspected both retained historical
PNGs under `history-ptct-767b07cfd830cd64` and
`history-ptct-7a53441d5e9f8326`: gray polygon beams on black, respectively cropped
and inside a desktop window. Their command, module identity, execution date and
reference session are unknown. They are historical visual context only.

`objdump -p` exposes only `glEnd` under OPENGL32, plus `LoadLibraryA` and
`GetProcAddress`. Runtime API tracing records dynamic resolutions including
`glGenTextures`, `glBindTexture`, `glTexImage2D` and `glTexCoord2f`. Sparse imports
are not the API profile.

## Actual texture and state evidence

Both fresh original runs issue one `glGenTextures`, one `glTexImage2D`, and 827
`glBindTexture` bridge calls over the retained interval. The trace hook executes
before context lookup, so issued calls must not be confused with accepted
uploads. The WebGL run additionally records current-context state and original
return addresses at entry:

| Guest time | Call | Context at entry | Original return address |
| --- | --- | --- | --- |
| 208 ms | `glGenTextures(1, 0x074ffeac)` | current 0, contexts 0 | `0x412310` |
| 208 ms | `glBindTexture(GL_TEXTURE_2D, 0)` | current 0, contexts 0 | `0x412322` |
| 208 ms | `glTexImage2D` | current 0, contexts 0 | `0x41236d` |
| 256 ms | `wglCreateContext` | current 0, contexts 0 | `0x411c08` |
| 256 ms | `wglMakeCurrent` | current 0, contexts 1 | `0x411c1b` |

The upload arguments are target `GL_TEXTURE_2D`, level 0, internal format
`GL_RGBA8`, 128×128, border 0, external `GL_BGRA`, `GL_UNSIGNED_BYTE`, pointer
`0x5f7324`. Its 65,536 captured pointer bytes include zeros and configuration
strings; they do not establish a successfully generated texture image. Small
read-only excerpts of original unpacked guest instructions retain the call
sites (`guest-texture-init.asm` and three 384-byte snippets). No executable was
patched or copied into evidence.

In `lib/gl-compat.js`, `OpenGLHostBridge.call` traces before `_call`; `_call`
returns when `_current()` is absent, before `glGenTextures` or upload dispatch.
The explicit WebGL context observation therefore explains the unaccepted
initialization. Software observes the same calls at 208 ms and its first
context creation/current at 336 ms; its cumulative accepted software uploads
and unsupported uploads both remain zero. No later upload is issued on either
route. Zero accepted uploads alone would not have established any of this.

All 165 observed frontend geometry batches on each route have both 1D and 2D
texture units disabled. All 113 retained bounded geometry samples match across
routes in raw vertices, modelview, projection, frame ordinal, enables and bound
names. Their vertex alpha values are zero; issued blend factors are
`GL_ONE, GL_ONE`, consistent with the earlier tracing note. Neither run issues
`glViewport`; the default drawable is 634×453 inside a 640×480 guest window.
The WAT mirror trust latch stays zero. Both retain matrix error `0x504`
(stack underflow); that observation alone does not identify an emulator defect.
The frontend histogram covers observed geometry dispatch, not an assertion
about unobserved future scenes or every possible native fast path.

## Animated scene review and timing

One software run and one WebGL run reached respectively 180,480 and 180,320 ms
of stepped guest time. Each recorded 36 presents and 165 geometry batches
(5,940 vertices); WAT counters match: 27,878 calls, 165 spans, 5,940 vertices,
23,744 flushes. These are animation observations, not gameplay or performance
measurements. Only 36 presented frames over this stepped interval were observed;
this is not evidence of the complete intro or normal-speed playback.

I personally inspected the following original screenshot pairs. Absolute guest
times differ; corresponding presents and all retained draw samples have a
constant software-minus-WebGL offset of 80 ms. Screenshot checkpoints occur in
160 ms stepping batches and differ by 160 ms. The table names checkpoint time;
`scene-call-comparison.json` records each last-presented frame and its time.

| Phase | Software checkpoint | WebGL checkpoint | Inspected content |
| --- | --- | --- | --- |
| 1 | 5,600 ms | 5,440 ms | Single gray beam on black |
| 5 | 26,080 ms | 25,920 ms | Two overlapping gray beams |
| 15 | 77,280 ms | 77,120 ms | Layered gray fan on the right |
| 20 | 102,880 ms | 102,720 ms | Bright white overlap stripe and left gray beam |
| 35 | 179,680 ms | 179,520 ms | Dense white fan in the lower right |

The sequence changes on both routes. Small visible raster/edge differences are
not established as defects by these phase comparisons. There is no claim of
pixel parity at equal absolute guest time. Agreement between emulator backends
does not establish Windows-reference parity. No verified Windows capture is
available here.

## Reproduction, identity and limitations

Evidence: `scratch/runs/20261106-ptct-texture-correctness/`. Run-only
`capture.cjs` uses the existing dev server, trusted browser Launch, registered
chooser startup, `WineFrozen.step(10,16)`, built-in detailed API tracing,
`OpenGLCompat.hooks.trace`, WAT census/trust exports, and read-only geometry and
module observation. Commands were `node <run>/capture.cjs software`, then
`node <run>/capture.cjs webgl`. Chrome 151.0.7922.108 used ANGLE SwiftShader;
URLs include `debug&no-threads&perf-stream&frozen=16&gl-renderer=<route>`.
The software capture is the browser's presented front image, not a depth-buffer
screenshot. `gl_sw_front` is 131805184; the other entry is 131805216.

Tested source base is Git `99967820f4fe619cc1022be991e5c20f757b9f2b` plus
`runtime-source.patch`; `tested-inputs.json` pins relevant files and both built
modules. Both actual instantiated modules match standard
`build/wine-assembly.wasm`, 2,178,624 bytes, SHA-256
`3b7511d12f3e8d364eb6bf29cdeed8b53af07abc53644d4f186e46f8620da149`.
Compilation/instance identity was observed, not inferred from a URL or file on
disk. `capture-verification.json` verifies 118 actual served files per route
against pinned/current source and media hashes with no unmatched identities.
`media-references.json` also pins the served MSVCRT DLL. No source/media archive
was made.

An early harness serialization error left software `startup.json` and
`phase-0.json` through `phase-24.json` containing literal `undefined`. These
files are preserved as failures. PNGs, progress records, console trace and the
continuous in-page census were unaffected. At 123,824 ms a second read-only
connection corrected BigInt serialization in the same live session, without
restarting or changing guest/render state. `read-correction.json`, late valid
checkpoints and `final-observations.json` retain the full cumulative trace and
bounded earlier geometry samples. WebGL used the corrected serializer before
its first launch. Screenshot checkpoint times before correction are reconstructed
from the retained progress/stepping recipe, not invented snapshot metadata.

Both runs report no page exception. The server records 404s for optional
`build-info.js` and `favicon.ico`; these are retained rather than concealed.
A locked full `tools/build.sh` passed and generated standard and compatibility
modules before capture. No emulator source changed, so no repair regression is
claimed or needed. This result is a documented initialization boundary, not
acceptance of complete texture/scene correctness. Follow-up requires evidence
about original pre-context initialization and a verified reference before any
semantic repair.

Cleanup completed inside the 09:03:01–09:48:01 UTC execution window:
`final-cleanup.json` independently reopens 20 absent process IDs, two refused
server ports, two absent browser profiles and four free build/runtime locks;
free `/home` exceeds 5.4 GB. No test box was used (ID/state/expiry not applicable).
No guest/runtime remains owned. The requested terminal `result.json` is an
investigation record using app ID `ptct`; no matching candidate-corpus manifest
entry was found, and it does not certify a registered candidate or gameplay.
