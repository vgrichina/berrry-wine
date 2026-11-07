# Registered Hexen II completeness effect and rejected image storage, 2026-11-07

`fece02eca` has a visible effect in the registered original: the previously black
statue and tree become flat grey geometry, and the black lower HUD blocks become
a white strip. Their images remain absent. Broad black world regions also remain
in this run, including after forward movement. This is an incomplete rendering
result, not visual parity or a restoration of the model/HUD artwork.

The first causal rendering blocker is an emulator-side texture storage failure:
the 3,550th observed `glTexImage2D` changes the WAT context error from zero to
1285 (`GL_OUT_OF_MEMORY`). Only the first 3,549 image calls reach the frontend.
Selected model/HUD objects subsequently have allocated metadata slots but no
defined image levels. No allocator repair is made: the available evidence does
not distinguish DIB backing exhaustion from DX/COM surface-record exhaustion.

Evidence root: `scratch/runs/20261107-graphics-texture-world/` (ignored). Paths
below are relative to this root unless explicitly stated. Preserve this run;
Git SHA and binary patches are the source recovery mechanism. No source or media
archive was created, and the guest executable/settings were unchanged.

## Identity, local qualification and fail-closed provisioning

The staged source was main `39c56a069a868292a6a867831d8e8882e19cdc2f`, containing
`fece02eca`. `source-commit.txt`, `runtime-pins.json`, empty
`relevant-source.patch`, and `new-lib_wininit-boot.js.patch` record the runtime
closure and relevant preexisting new file. `owned-inputs-final.patch` recovers
the small run-specific helpers. Runtime inputs were transferred individually;
registered media remain referenced by their existing paths and SHA-256s in
`registry-media-closure.json`, with all 16 references checked locally before
allocation. The registered root `installed/GLRoot/glh2.exe` was 545280 bytes,
SHA-256 `76d96731e3076441e5c70bce2089cd8f36f25b373214f656aa9d5cd8d532e9dd`.
The original root layout excludes MiniGL and retains the original settings.

`local-control-exact-threads/terminal.json` passes the current production
CLI/headless-GL/stdin composition with the closed trace window, numbered ping,
error reply, snapshot, composited PNG and balanced Enter. UP is armed before
submitting DOWN. The accepted input matrix was not repeated.
`local-native-wgl.log` passes actual native context creation, red readback
`[255,0,0,255]`, and destruction with zero remaining contexts. Native package
pins match the retained local closure (`native-preallocation-verification.json`).

The prior provisioning shell had continued after a comparison failure. This
run's `pin-gate.py` makes functional runtime/native mismatches raise before
launch. It runs during remote preflight and again immediately before spawning
the original. `pin-gate-tests.json` proves changed runtime, changed native and
missing native files cannot reach launch; matching functional files pass while
generated npm metadata differences are explicit. These are run-specific
provisioning helpers, not a change to the shipped emulator.

All 473 runtime/input pins and 161 functional native files matched remotely.
The separate generated `node_modules/.package-lock.json` difference is **only**
the root `name`: `graphics-repaired-pair-native-deps` becomes
`graphics-texture-world-native-deps`. Replacing that field in the retained local
bytes reproduces the exact remote length 3328 and SHA-256
`538e50dbeba6bb5806bf79162b2e6cefee2a3366a3060a96fecac21e406881be`.
See `generated-lock-metadata-difference.json`,
`native-remote-local-comparison.json`, and retrieved `functional-pin-gate.json`.
The mismatch was reported separately; functional comparisons were enforced.

The original used production `test/run.js --app=hexen2_demo --no-build
--control-stdin --headless-gl --threads`, 600-second cap, batch size 50000,
default clock, and closed instruction trace window `1000000000..15000`.
Exact argv is `retrieved/actual/threads/launch.json`. Local Node was v24.18.1;
remote Node was v24.22.1. Native renderer was Mesa llvmpipe LLVM 20.1.2,
640x480, WebGL 1.0 / GLSL 4.50. This provider identity is not performance proof.
All 152 observed runtime reads match staged pins (`retrieved/loaded-audit.json`).
The compiled/instantiated standard WASM was 2182493 bytes, SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`, 2288 exports.
Both WASMs and the selected native package binaries were recovered.

## Reviewed original and visible comparison

One fresh UUID-idempotent allocation created `bx_s3dcvnbt` at 16:29:12Z, initial
expiry 16:54:12.735Z. The independent 1500-second normal-stop watchdog was armed
and verified alive before allocation (`watchdog-ready.json`,
`watchdog-alive-before-allocation.json`). No second original or heavy guest ran.

Each composited view was inspected before its next input:

| Capture in `retrieved/actual/threads/` | Review and next action |
| --- | --- |
| `notice.png` | GLHexen2 notice, OK selected; Enter |
| `post.png` | MAIN, Single Player selected; Enter |
| `menu-1.png` | SINGLE PLAYER, New Game selected; Enter |
| `menu-2.png` | Class selection, Paladin; Enter |
| `menu-3.png` | Difficulty selection, Apprentice; Enter |
| `menu-4.png` | Natural model meshing/loading; passive 20-second wait |
| `menu-5.png` | First-person world, flat grey statue/tree, fists, white HUD strip and broad black world regions; Up Arrow |
| `menu-6.png` | Grey foreground geometry leaves view; black obstruction fills world area, fists/HUD remain; finish |
| `terminal.png` | Final released-input view; normal quit |

Five Enter pulses held 150ms and one documented Up Arrow pulse held 1000ms.
Every release was independently armed before DOWN; all 32 numbered replies were
successful and contiguous (`control-custody.json`). No control UNKNOWN, replay,
coordinate click, private game handler or guest write occurred. The before/after
Up views show a changed first-person view consistent with moving toward the
foreground obstruction; no displacement or speed is inferred.

Before-fix composited world/movement captures were personally inspected from
`scratch/runs/20261107-graphics-threaded-followthrough/review/threads/menu-5.png`
and `menu-6.png`; their lengths/hashes are in `baseline-references.json`.
That prior original used the same registered route, settings, renderer and
thread mode. Wall times, animation/health differ, so this is a qualitative
comparison, not a pixel-matched A/B. The new run's broad black world regions
prevent any overall visual-correctness claim. All ten recovered PNGs decode
(`png-decode-review.json`); `final-raw.png` is a 512x256 texture atlas, not the
composited world.

## Missing images: bounded lifecycle and first causal blocker

`texture-lifecycle-summary.json` indexes the passive emulator-only observation:
18,307 metadata records, 5,543 image API entries/exits, 3,549 frontend uploads,
120 armed draws, and compiled/instantiated module pins. The losslessly compressed
raw metadata is `retrieved/actual/threads/raw/gl-state.jsonl.gz`. No typed-array
values, complete source trees or media archives were logged.

At 16:31:42.533Z the first nonzero WAT context error appears on image call
3,550. The immediately preceding successful frontend upload belongs to texture
507, whose recorded levels are 64x64, 32x32 and 16x16, internal format 4.
The failing request's exact name/dimensions are **unqualified**, for the observer
limitation below. The subsequent 1,994 image API calls produce no frontend image
uploads. Error 1285 stays latched; it is not a separate fresh error measurement
for each subsequent call.

| Selected names | WAT image/storage evidence | Frontend image evidence |
| --- | --- | --- |
| 725, 754 (previously sampled model textures) | Metadata slots exist; all 12 levels remain undefined, surface/dimensions/format zero, error 1285 | Zero uploads |
| 835..843 (previously sampled HUD textures) | Same empty first/last observed level state and latched error | Zero uploads |
| 779..781 (new bounded world draw sample) | Outside the selected WAT object index | All 120 sampled draws incomplete with zero frontend levels |

The observer wrapped image, binding, deletion and sharing paths without changing
their arguments, return values or error state. There was one context, one
frontend share group, and no observed deletion/share operation that could explain
losing these images. The selected objects are already undefined when first
observed, rather than showing a defined image later removed by deletion/sharing.

Tracing **our emulator source** identifies the rejection boundary:
`src/09a8b-handlers-opengl.wat` `$gl_2d_store` calls
`$d3d9_create_surface`; a zero result sets context error `0x505` and returns zero
before writing image-definition metadata. `src/09a8c-gl-encoder.wat` then returns
without forwarding that canonical upload to the frontend. Surface allocation
in `src/09ad-handlers-d3d9.wat` can fail either DIB reservation or DX/COM object
creation. Thus completeness fallback cannot restore the missing model/HUD
images: their emulator CPU storage definitions failed before host upload.
No guest reverse engineering or modification was used. The next focused step
is to discriminate those two allocation failures with bounded occupancy/request
metadata in a local storage reproduction, before proposing an allocator change.

Observer limitation: auxiliary API argument arrays used `test_g2w_slow` directly
for a direct-window guest stack and are invalid. They are preserved but excluded
from every conclusion. Frontend scalar dimensions/formats and direct WAT context,
object and level snapshots use separate paths. The production CLI textual API
trace was also suppressed by the closed trace window, so it supplies no repair
for the invalid argument fields. See `observer-argument-limitation.json`.
No original was replayed to repair observation.

## Recovery, shutdown and publication

Runtime/native postflight pins match. `retrieval-verification.json` and
`prestop-retrieval-verified.json` verify 83 references / 81 unique recovered
contents, 7,143,813 referenced bytes, by size and SHA-256 **before** normal stop.
The guest exited normally with status zero at 16:32:57.904Z. Remote cleanup
finds no owned live guest/supervisor; no browser, profile, control port or remote
watcher was created. All source recovery patches and small helpers remain local.

Explicitly delegated normal stop `stop_6b7edce188220571` completed at
16:33:49.364Z, forced=false, error=null. State is **archived**, current expiry
null, retention unknown. The independent watchdog observed completed shutdown
and exited. Local cleanup closes the board watcher and checks owned processes;
/home remains above 2 GB. No public deployment occurred. No visual parity, FPS,
audio-quality or concurrent guest-execution claim is made.

Only this note is committed on main; the tested provisioning helper change is
retained as evidence patches, with no shipped Win32/OpenGL/allocator change.
`publication.json` records the note commit and immediate pull/push result.
