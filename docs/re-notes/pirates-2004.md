# Sid Meier's Pirates! (2004)

`test/binaries/candidates/pirates-2004/digital/app/Pirates!.exe`, registry id
`pirates_2004` (`d3d9Programmable`, `bigMemory`). Direct3D 9, statically linked
(`d3d9.dll` import), with msvcr71/msvcp71, Bink, Miles (mss32 plus its
`win32/*.asi`, `*.m3d`, `*.flt` providers) and oleaut32 from the game directory.

## Route to the main menu (CLI, software D3D9 arm)

```sh
node test/run.js --app=pirates_2004 --d3d9-renderer=software --batch-size=100000 \
  --max-batches=1000000 --max-seconds=180 --stuck-after=1000000 --no-close --png=menu.png
```

The D3D9 main menu (Play Sid Meier's Pirates!, Load A Game, Change Your System
Options, Visit The Firaxis Website, Visit The Hall Of Champions, View Credits,
Quit, over the Caribbean map) is up by batch ~1000 at `--batch-size=100000`.
Assets load from `assets\pak*.fpk` one byte per `ReadFile`, which is slow but
correct. Evidence: `scratch/runs/20261006T033534Z-pirates_2004-dxinit`.

## Startup, as reverse engineered (2026-10-06)

- `0x4d2950` is graphics init. It calls `0x500080` (device setup); a nonzero
  result goes to an error path that first asks the DxDiag provider for the
  DirectX version (`0x4ad050`, through the game's `dxdiagn.dll` COM server)
  **only to choose the message**: below 9.0c (`0x90003`) it shows the
  "requires DirectX 9.0c" text at `0x70e234`, otherwise "Unable to initialize
  DirectX." So that message never means the DirectX version check failed.
- Device setup creates a HAL device with software vertex processing
  (BehaviorFlags `0x24`), reads the render target, depth surface and
  `GetDeviceCaps`, and at `0x5c0963` requires `MaxTextureBlendStages >= 2` and
  `MaxSimultaneousTextures >= 2`. Its caps record is at `this+0x644`; it also
  reads MaxVertexBlendMatrices (`+0xa8`), MaxStreams, and the vertex/pixel
  shader versions (`+0xc4`/`+0xcc`; the helper at `0x5002f0` returns them as
  major*10+minor to about twenty callers).
- Miles' A3D provider `win32\mssa3d.m3d` asks `CoCreateInstance` for
  Aureal's class (`a3dapi.dll`), which no machine without an A3D card has.

## Fixed

| commit | what |
|---|---|
| `ba161dfb` | D3D9 caps advertise `MaxTextureBlendStages = 6` (was 0) |
| `12408feb` | a `CoCreateInstance` whose in-proc DLL is missing resumes the caller (the yield pump left EIP on the thunk and re-ran it on the caller stack) and clears `*ppv` |
| `d7f5a429` | `test/run.js` honours `bigMemory` (2048 MB); at 512 MB the asset load runs out of guest heap |

## Not yet looked at

Gameplay (`Play Sid Meier's Pirates!`), audio, the WebGL arm at this build.
`ole32.dll` is absent from this box's `test/binaries/dlls`, so the Miles
providers' ole32 imports fall to WAT stubs.

## TG77 cooperative thread attach (2026-10-14, unresolved)

Safari reported `DllMain did not complete` for module `0x9f1000`, reason 2,
with restored caller EIP `0x9fc4bb`. Chrome cooperative evidence supplied by
the runtime investigator (`scratch/runs/20261014-pirates-browser-cooperative`)
places the actual msvcr71.dll callback at `0x7503fc0`, yield 9 / halt 4:
a critical-section wait. The section owner remains to be captured.

Source inspection and the cheap `node tools/pirates-attach-gap.js` witness
confirm that the synchronous callback runner restores the caller and releases
the callback gate on this wait; retrying the notification repeats previously
completed DLL callbacks. This mock reproduction is not real-PE acceptance.
See [continuation interface and regression plan](../pirates-attach-continuation-plan-20261014.txt)
for the required owning-thread scheduler integration, cleanup contracts and
unexecuted real-PE/browser gates. No production fix is included.

## Cooperative thread-attach regression (2026-10-14, TG77)

The Safari report on module SHA256
`e6ac188dd8c7b16d04eaa4b74446ab2c4ab211422738709e33cffda5db444e7e`
reports `DllMain did not complete: module=0x9f1000 reason=2`.
Reproduced with the existing pinned corpus acquisition on temporary
`bx_tgbme2h7`, Chrome, isolated page, `?debug&no-threads&app=pirates_2004`.
Source was `43f04c7c4ac8914c385c37a7be96c7e1b9f61623`, same module hash.
No guest patch, capability override, or DllMain completion bypass was used.

The loader identifies `0x9f1000` as **msvcr71.dll**, preferred base
`0x7c340000`, entry `0x9f329f`. Several prior callbacks complete normally.
The failing callback stops at `EIP=0x7503fc0 yield=9 halt=4`: a critical-section
wait, not the callback budget limit. The later crash report's `0x9fc5ec`
(Safari reported `0x9fc4bb`) is the restored caller state, not that wait thunk.
Increasing budgets or marking the unfinished attach complete would hide the
scheduling problem.

Next capture the contended section and its owner, then implement resumable
thread-attach scheduling with a real contended-lock regression. Preserve the
callback frame, loader serialization, and exactly-once notifications while
allowing the owner to run. `pumpThreadsOnce` deliberately refuses entry while
already running a cooperative worker, so it is not a drop-in fix here.
The owner and precise lock have not yet been established. Worker-mode and
Safari retests remain separate; no fix or gameplay acceptance is claimed.

Evidence: `scratch/runs/20261014-pirates-browser-cooperative/` contains the
90-second probe, six captures/state snapshots, browser log and process receipt.
The final fatal-error screenshot was reviewed. The original user report is in
`scratch/runs/20261014-pirates-user-crash/report.txt`.

## Cooperative continuation candidate (2026-10-14, runtime verified)

Task branch `task/pirates-attach-fix` now retains the notification generator,
module cursor, snapshot pins and loader gate through ordinary scheduler turns.
Candidate production source `16961623b` freshly built to WASM SHA256
`70c6d329d51eee5db553715f53ffc47f3e6e2491b54ae5327f1b8b012427d655` passes
the real-PE contended-section regression and existing main/Worker DllMain
completion, load-context and callback-serialization tests.

The original cooperative Chrome startup now reaches the visible Main Menu.
The actual msvcr71 callback still parks at `0x7503fc0`, yield9; captured section
guest `0xa3c190` (WASM `0x64e190`) is owned by **thread1/main**, recursion1.
First recorded tid6 park retains its actual frame and loader gate `[6,1]`;
5.415ms later its callback returns, followed by sequence completion and gate
release `[0,0]`. Four such waits complete during the 90-second run. Thus this
route's owner can run and release the section with ordinary scheduling.

Evidence `scratch/runs/20261014-pirates-attach-candidate/` includes raw traces,
test/build receipts and reviewed final menu capture. The baseline module is
older, so the screenshots alone are not a controlled version A/B. No gameplay
input, affected Safari validation, merge or deployment is claimed. Blocking
nested initialization and synchronous exit-detach remain existing boundaries;
see `docs/pirates-attach-candidate-20261014.txt` for exact test scope.


## Original browser main menu (2026-10-31)

The registered original `pirates_2004` reached an inspected Main Menu in
Chrome 151 using the WebGL selection and retained module
`573e235db16e351668289f49e2f279ff48bcad56e7ca533167cb94cd6f4ec3fc`.
This was a retained-module run; its full source identity was not reconstructed,
so it is not a fresh current-main build or a controlled comparison with the
October 14 callback candidate. Original assets and host sources were unchanged.

The title splash preceded the menu. Escape, Enter and one canvas click were
recorded as trusted input; keys and buttons were released. The UI slice changed
from Auto (logged as 100000) to 5000, then 50000. The menu capture shows Play,
Load, Options, credits and Quit over the original Caribbean map. Its late
metadata records a visible 800×600 game window at GPU sequence 3. Subsequent
Play-selection/control requests failed or stopped completing while browser
target discovery still responded. There is no verified Play consumption,
character creation, sailing or gameplay result, and no established cause for
the control failure. Resource lookup 404s occurred; no fatal API trap was
observed. No production fix is claimed.

Evidence: `scratch/runs/20261031T0200Z-pirates-original-browser/`, especially
`loading-3min.png`, `loading-3min.json`, `actions.jsonl`, `verification.json`
and `recovery.txt`. Verification covers 1374 original input pins, 266 served
responses and 141 unique host paths. The controller exited 0 after explicit
quit; its browser, profile and three ports were closed. No Boat was used.
The next runtime check should start with a small UI slice and test original
menu selection; this capture establishes rendering only.

## Original new game reaches sailing (2026-10-31)

A second local Chrome 151 run started with UI slice **5000** before Launch,
cooperative execution and the same retained `573e235d…` module. Native mouse
and keyboard input advanced Play → Crew Signups → tavern → English captain
welcome → crew decision → **cast off at Port Royale**. The inspected sailing
view shows the ship, ocean, port, 600 gold and 41 crew. Subsequent paired
Right and Up key inputs were delivered; the ship becomes visible and the
coast/port position changes across the captures. This establishes progression
beyond the menu and an updating original sailing scene; the small sample does
not isolate each key's effect or qualify a voyage, combat or objective.

Rendering remains visibly defective: the mountains are white, and the console
records 270 “specular lighting is not implemented” errors. Their causal
relationship is unproven. No source fix, complete graphics acceptance, audio
acceptance or persistent save is claimed. This retained module's full source
identity remains unknown; it is not a newly built main revision.

Evidence: `scratch/runs/20261031T0215Z-pirates-small-slice/`. Personally inspected
`play-enter.png`, `crew-confirm.png`, `captains.png`, `captain-continue.png`,
`captain-next.png`, `cast-off.png`, `sailing-turn.png` and `sailing-sails.png`
show the route. `actions.jsonl` and screenshot metadata retain timing and
25 trusted input events, with all keys/buttons released. Verification matches
1374 original input pins, 465 served responses and 141 unique host paths;
179 artifact hashes preserve the run. Explicit quit closed the browser,
controller (exit 0), three ports and profile; no Boat was used.
`recovery.txt` records the exact native route. A next graphics investigation
should first reproduce the white terrain with a source-identified build and
compare a matched scene, rather than infer a cause from the specular warning.

## Current-main build identity check (2026-10-31)

A locked canonical `tools/build.sh` passed at main `90c0c0c48`. Tracked
source hashes remained unchanged across compilation. Its 1,896,705-byte module
has SHA-256 `573e235db16e351668289f49e2f279ff48bcad56e7ca533167cb94cd6f4ec3fc`,
exactly matching the retained module used for the successful sailing run above.
This supplies a reproducible current-main source identity for those module
bytes; it does not turn the earlier execution into a fresh runtime replay.

The new browser run rendered Main Menu, but its browser PID disappeared and
CDP refused connections before the new-game route completed. The cause is
unknown. No new sailing or terrain comparison is claimed. Evidence is in
`scratch/runs/20261031T0220Z-pirates-main-sailing/`: `build.log`,
`source-before.json`, `build-identity.json`, inspected `captains.png`, and
`verification.json`. Explicit controller quit completed; its browser, profile
and three ports were closed. No Boat was used. The next graphics task still
needs a matched sailing scene and a measured rendering contract before
attributing the white terrain to the unsupported specular path.

## WebGL fixed-function specular lighting (2026-10-31)

`lib/d3d9-fixed.js` now computes the fixed vertex stage's specular RGB using
material specular times the sum of each light's specular color, half-vector
power, attenuation and spotlight factor. It follows Microsoft's
[D3D9 specular equation](https://learn.microsoft.com/en-us/windows/win32/direct3d9/specular-lighting),
including the finite camera-to-vertex viewer vector and the infinite viewer's
`(0,0,1)` vector. Material/COLOR1/COLOR2 selection uses the existing fallback
and COLORVERTEX rules; normals use the inverse-transpose world-view transform
and optional normalization. Back-facing lights and degenerate vectors produce
no highlight. Power zero avoids GLSL's undefined `pow(0,0)` case.

The specular sum is clamped per vertex, interpolated separately, and added
after the texture cascade without changing its alpha. Mixed programmable pixel
shader post-specular and software-backend specular remain unsupported and
guarded. This rendering implementation does not establish the cause of the
white terrain in Pirates.

Focused `test/test-d3d9-specular-web.js` passes **86 actual WebGL1/2 pixel
checks** against an independent scalar vertex-lighting/interpolation reference:
directional, point and spot lights; attenuation/range/cones; material sources
and missing-color fallbacks; COLORVERTEX; powers 0/1/2/4/20; finite/infinite
viewer and translation; inverse-transpose normals and normalization; zero
vectors/backfaces; accumulation/clamping; texture replacement and alpha.
The mixed-stage and software-backend regressions pass. The unmodified existing
lighting WebGL suite fails with `invalid light attenuation` on its known
“all-zero attenuation reads as 1” fixture. A diagnostic run excluding only that
case passes the remaining 76 pixel checks; the full suite is not a pass.
Locked `flock /tmp/wine-build.lock bash tools/build.sh` passes and reproduces
the canonical `573e235d…` module. Evidence is retained in
`scratch/runs/20261031T0221Z-pirates-specular/`, including test/build logs,
renderer source patch/hash and original-asset verification.

The bounded original-asset retest **reached sailing with the new renderer**.
The successful attempt is under `final/`: UI slice 5000, cooperative execution,
Chrome 151 / ANGLE SwiftShader, canonical `573e235d…` module, and served
`d3d9-fixed.js` SHA-256 `13c8e353e63ecc11f544259aee8891f9f2ecf8a9aa0f99d0d96e2805da8791a6`.
Native Play → Crew Signups → tavern → English captain reached **St. Kitts**,
with 600 gold and 41 crew. Escape briefly opened System Options; returning
showed the sailing scene, then the ship entered town. Native Sail away →
“No matter, cast off!” returned to sea. Right and Up inputs followed; inspected
`cast-off.png`, `castoff-turn.png` and `castoff-sails.png` show changing ship
orientation and coast position. Their individual control effects are not
isolated, and no combat, voyage objective, audio or persistent save is qualified.

White terrain **persists**. The successful run has zero specular rejection
messages and no page exceptions; its console errors are 28 HTTP 404s. Thus
specular support does not resolve this visible defect. This is a different
starting port from the earlier Port Royale capture, not a frame-matched terrain
comparison, and the terrain's cause remains unproven.

The first attempt captured the title, then timed out on premature menu input
and returned to the launcher; the reload's cause is unknown. A retry correctly
refused a canonical-module/generated-map mismatch after another worker changed
the shared map. The successful run therefore serves the **first** captured host
source versions from this run, including the new renderer and canonical
`54a33f1054df7c3f` map, with a retained URL-to-hash mapping. It does not pair
the old module with the concurrently edited mirror. All 1374 original input
pins match the prior canonical run; the successful route retains 466 served
responses and 34 trusted input events, with no held keys/buttons. Own browsers,
controllers, servers and profiles were closed; no Boat/test box was used.
`recovery.txt` and `verification.json` retain the exact route and limits.
Next: investigate the actual terrain texture/material draws with a matched
scene; do not treat removing the specular rejection as a terrain fix.

## White-coast draw boundary investigation (2026-10-31)

The white coast is reproduced using the previous run's **matched** `573e235d…`
module, `54a33f1054df7c3f` map and specular renderer `13c8e353…`. There is no
terrain repair in this change: the measured renderer behavior agrees with the
submitted state, and the upstream reason for that state remains unresolved.
Evidence and a self-contained source/module recovery recipe are in
`scratch/runs/20261031T0240Z-pirates-terrain/recovery.txt`.

A bounded original sailing trace identifies a **4,936-triangle coastal draw**
that writes the pale pixels. It has stride 32, FVF `0x112` (position, normal,
one UV), no vertex colors, **no bound textures**, and null vertex/pixel shaders.
Stage 0 selects DIFFUSE; diffuse/ambient material is `(0.5,0.5,0.5,1)`, with
lighting enabled and specular disabled. The directional light's diffuse RGB is
`1.78559768`. This is not a texture decoder producing white texels: this draw
has no texture to decode. A subsequent 700-call sea trace retains neighboring
texture pixels and finds the same untextured terrain, no draw errors and no
offscreen color attachment in the bounded scene. Neither trace establishes
that all terrain draws or all frames use this path.

Read-only guest/WAT draw-state snapshots confirm null texture pointers before
the JavaScript bridge copies the draw. Original game renderer inspection finds
`NiD3DDefaultShader`, equal to the renderer's default at `+0x898`; the observed
mesh has zero property-state and shader-extra pointers at `+0xc0`/`+0xc8`.
Disassembly around `0x5c4270` shows the shader-extra lookup and default fallback;
the draw reaches `DrawIndexedPrimitive` at `0x5c43b7`. Shader counters report
12 creations and **zero refusals**, with zero declaration rejects. These facts
locate the investigation before backend pixel shading; they do not prove
whether initialization, capability handling, state emulation or original game
logic caused the absent terrain attachment. No missing-asset or lighting-root-
cause claim is made.

The retained real geometry/state is replayed through actual WebGL 1 and 2 with
an independent scalar lighting, projection, depth selection and interpolation
calculation. Both sampled points match **exactly in both versions**:
`[225,220,249,255]` and `[191,186,216,255]`. `replay-frozen.cjs` uses the exact
retained renderer sources; its four pixel assertions pass. Changing shared
lighting or substituting a texture would mask this evidence without addressing
the demonstrated default-shader/material selection. The existing all-zero
attenuation fixture failure predates this investigation; its suite was not
rerun or claimed to pass. A fresh locked `tools/build.sh` passes, but produces
a different module/map and was deliberately not substituted into this replay.

Native St. Kitts **Sail away → No matter, cast off!** returns to sea with
600 gold and 41 crew. Inspected `castoff-settled.png`,
`native-turn-after-trace.png`, `native-sails-after-trace.png` and
`sailaway-final.png` show movement past Nevis to a Port Freedom landing prompt;
Enter on “No, sail away” returns to the sailing HUD. White coast persists.
Simulation continued during diagnostics, so individual key effects are not
isolated; this does not qualify combat, voyage objectives, audio or saves.
All 50 recorded inputs are trusted and released. All 1,374 original pins and
472 served responses match; zero specular rejects/page exceptions, 28 HTTP
404s. Own browsers/controllers/ports/profile are closed; no Boat/testbox used.

Next: instrument original terrain construction near `0x4e6bc2` and the
`0x4ee360`/`0x4ec000` binding path, capturing capability results and the mesh
property/shader attachment lifecycle. `TerrainShader` is enabled at runtime;
its capability bypass flag is zero. The blocker is the unexplained absence of
terrain texturing/shader attachment before draw submission, with a recoverable
original sailing route and measured backend behavior, not a tested terrain fix.

## Upstream terrain setup and queue boundary (2026-10-31)

A further bounded investigation retains the same original `573e235d…` module,
`54a33f1054df7c3f` map and frozen host in a new run,
`scratch/runs/20261031T0258Z-pirates-attachment/`. White coastal terrain is
again visible at Barbados in `attempt2/sea.png` (600 gold, 41 crew). No game
flags, assets or production emulator code were changed. No terrain repair is
established; the previous independent pixel replay was deliberately not repeated.

The successful startup capture has **179 guest breakpoint records** in
`capture/complete-records.json`: five setup observations followed by 58 tiles
at each of three boundaries. `0x4e6b51` returns true from the Landscape.ini
helper. After capability helper `0x5002f0`, `0x4e6bc7` has version results
**11 / 14**, meaning VS 1.1 / PS 1.4. Disassembly reads the versions from
GetDeviceCaps offsets `0xc4` / `0xcc`. The force-disable flag `0x8cad10` is
zero and the `TerrainShader` flag at `0x7263b8` is enabled. Setup proceeds to
stage 2 and selects the factory whose vtable is `0x70fe58`, retained at tile
`+0xa8`. This excludes an early zero-capability rejection in this captured
initialization; it does not qualify the full caps structure or shader execution.

The two suggested attachment addresses have more limited roles:

- `0x4ee360` synchronizes and inserts the tile into the terrain manager's
  array at `+0x74` through `0x4fd880`. Every observed return at `0x4e6f07`
  is 1. The initialized manager retains 58 entries.
- `0x4ec000` clears and fills the tile's collection at `+0x114`, walking
  the global texture object array at `0x8ea110`. At `0x4e6f11`, all 58
  tiles have ten collection entries. This establishes references, not decoded
  texture correctness or binding to a particular geometry draw.

Tile `+4` is initially a **NiNode**, not the measured NiGeometry draw mesh;
its `+0xc0` / `+0xc8` fields cannot be interpreted using the geometry layout.
The unresolved causal boundary is now between successful factory/texture
collection initialization and the eventual geometry property/shader attachment
(or its later removal). The prior actual coastal geometry still supplies the
opposite end of that boundary: null property/shader-extra and default shader.
Static next targets are the selected factory's first virtual method
`0x4edac0` (allocates and calls `0x51ccf0`) and deferred terrain-manager
processing through `0x515cb0`, including queue consumption at `0x5161b0` and
its virtual call at `0x516268`. Correlate their generated child geometry with
the coastal draw before assigning a caps, synchronization or shader defect.

A diagnostic obstacle was reproduced separately: the retained WASM debugger
can skip the first arrival after changing a breakpoint. The focused regression
fails on that module (`retained-debugger-regression.log`); it is not a terrain
root-cause finding. The final run-local tracer consumes the old breakpoint's
resume step before retargeting and handles successive breakpoint halts in a
loop. Earlier failed or missed captures are retained as such. The complete
JSON export is authoritative; Python readers of JSONL must split on literal
newline, since sampled guest strings can contain Unicode line separators.

Diagnosis/runtime ended within the 25-minute limit. Evidence checks cover the
179 records, all original input pins, all served response hashes, and cleanup.
All six own browser/controller executions and profiles are closed; no Boat or
assigned test box was used (ID/state/expiry N/A). Recovery instructions and
limits are in the new run's `recovery.txt`; no before/after repair or new build
pass is claimed for this documentation-only change.

## Deferred output correlated with coastal draw meshes (2026-10-31)

Run `scratch/runs/20261031T0318Z-pirates-deferred/` advances the deferred
boundary without changing production code, original assets, flags or shader
selection. The original white coast was inspected first at St. Kitts/Nevis
(`capture/sea.png`), then at Port Royale (`retry/original-coast.png`, 600 gold,
41 crew). No backend reference test was repeated and no repair is claimed.

The first execution observes factory `0x4edac0` returning through `0x512ba7`
on thread 5 with work object `0x09de1f00`, vtable `0x70fdd4`. Its later live
snapshot has ten references at `+0x8c`, its own NiNode at `+8` (`0x09de1b70`),
and child `0x09de2de0`. Tile `+4` is a different node. This execution's queue
breakpoint did not fire; that limited observation does not establish that
queue processing was skipped. The page subsequently crashed after installing
a draw observer, leaving no usable draw export from this execution; cause is
unestablished (`capture/crash.jsonl`).

The retry supplies **97 breakpoint records**: factory entry/return plus 19
complete generator cycles at `0x4efcf0`, `0x4efe5c`, `0x4eff53`, `0x4eff5b`
and `0x51ceae`. Eighteen geometry returns are non-null; one is null. At
`0x4efe5c`, EAX is the geometry factory's output. At `0x4eff53`, the geometry
in EBP has become a child of work `+8`, after the node's virtual `+0x70`
call at `0x4eff1d`. Virtual work `+0x38` (`0x4efcc0`) then inserts it into
the cache through `0x524e90`; this is not itself a direct shader setter.
The generator returns through `0x51ceae` to work setup. The first work
object remains the tracer's `factoryOutput`/`node` snapshot across later
cycles; use each cycle's ECX/ESI and returned EAX/EBP for other work objects.

Crucially, **ten distinct non-null generated geometry pointers match actual
coastal draw submissions** in `retry/mesh-evidence.json` (11 observations,
plus one unmatched ship mesh). Examples are `0x09e896c0` / 4334 triangles,
`0x09e8e010` / 5358 and `0x09e87280` / 7606, all FVF `0x112`. The pointer
correlation closes the factory-to-draw identity gap for these meshes. The
first generated geometry `0x09e849c0` already has four property-list entries
at factory return, with `+0xc0` and `+0xc8` zero; those fields stay zero
through node attachment, cache insertion and generator return.

`retry/properties.json` walks each observed draw mesh's actual property list
and resolves property RTTI through its guest vtable. The ten generated draw
meshes carry **NiAlphaProperty, NiRendererSpecificProperty,
NiTexturingProperty and NiVertexColorProperty**. The renderer-specific
property has non-null data at `+0x20`; the texturing property has non-null
storage at `+0x2c` and `+0x44`. These are attachment observations, not proof
that their internal maps or textures are valid. The draw shader's RTTI is
**NiD3DDefaultShader**, and all observed generated draw meshes still have
zero `+0xc8`. Thus absence of the geometry's property list is excluded for
these draws. The newly bounded unresolved transition is consumption of the
attached renderer-specific/texturing properties into effective shader state
and the shader-extra path used by `0x5c4270`. Trace that transition and its
input payload before changing capability flags, substituting shaders or
asserting an emulator cause.

Diagnosis/runtime stopped at 03:38 UTC, within the 25-minute bound. The
retained module remains `573e235d…` with its matching frozen host. Recovery,
all static excerpts, original/served hash verification and local lifecycle
checks are retained in the run directory. Both owned browsers, profiles,
controllers and servers are closed; no Boat or assigned test box was used
(ID/state/expiry N/A). This documentation-only result has no new production
build or before/after repair claim.

### 2026-10-31 effective-property boundary (03:41Z, no fix)

Evidence: `scratch/runs/20261031T0341Z-pirates-effective/`. This bounded
follow-up reuses the retained `573e235d…` module and its 140 matching frozen
host files; **source identity remains unknown**. It does not repeat
capability, backend or factory discovery. No production code or original
assets changed.

Static original-EXE tracing narrows the boundary:

- `0x534270` assembles the linked property list into a `0x38`-byte state,
  indexing `state + 8 + 4 * propertyType` using property virtual `+0x34`.
  `0x53e800` retains this at **geometry `+0xb4`**. `0x53e870` handles the
  separate **effect state at `+0xb8`**. Diagnostic helpers must not label
  `+0xb8` as the assembled property state.
- `0x5c4270` selects a shader using geometry `+0xc8` and RTTI helper
  `0x449390`; a null result selects renderer `+0x898` at `0x5c4298`.
  At `0x5c42bf`, shader virtual `+0x14` receives renderer `+0x10`
  (property state) and `+0x14` (effect state) separately as arguments four
  and five. Thus attached properties and shader-extra are distinct inputs.
- Default-shader setup `0x5d4520` takes property state as its **fourth**
  argument (entry ESP `+0x10`, loaded into EBX at `0x5d452b`). It reads
  state `+0x28` at `0x5d458a`, the texturing-property slot, and then
  texturing map storage at property `+0x2c`. The unresolved live comparison
  is attached properties versus renderer effective-state slots, followed
  by actual map consumption.
- Renderer-specific property `+0x20` is an eight-byte wrapper (vtable
  `0x712848`). Construction at `0x51c70d` assigns wrapper `+4` an object
  produced by `0x5c9680`, before attachment at `0x51c776`. Wrapper clone
  `0x51c3f0` retains that same reference; destructor `0x51c390` releases it.
  The object has per-entry `0x18`-byte storage and data-copy routine
  `0x5c96f0`. This does **not** establish that the payload is a shader or
  should be installed at geometry `+0xc8`.

The live boundary remains unobserved in this run: three owned Chrome pages
crashed during native progression. The retry reached a rendered tavern
(`retry/no-quit.png`) and crashed before any diagnostic helper was installed;
the final attempt stopped at the Play menu while loading `openpc.wav`.
The generic page-crash events do not establish a runtime cause. The prior
run's original Port Royale white-coast screenshot was personally inspected;
there is no new gameplay coast capture or before/after repair claim.

`recovery.txt` preserves static excerpts, replay drivers and the **unexecuted**
`final/boundary-trace.js`. Next, recover native coast progression and capture
`0x5c429e`, `0x5c42c2` and `0x5c4375`: compare attached renderer-specific
and texturing pointers with effective property-state slots `+0x18` and
`+0x28`, retain payload wrapper/object words, and trace map consumption.
Record the prepass return before assuming later breakpoints are reachable.
No shader substitution is justified by the current evidence.

`verify.py` passed all 1,374 original input hashes, 140 frozen mappings,
876 served responses and all three loaded-module hashes. All owned browser
PIDs, profiles, controllers and static/control/CDP ports are closed; no Boat
or test box was used (ID/state/expiry N/A). Disk remained above 2 GB. This
is documentation-only; no new production build or focused code-test claim.

### 2026-10-31 known-source crash/boundary investigation (04:55Z)

Evidence: `scratch/runs/20261031T0458Z-pirates-knownsource/`. The prior
`573e235d…` module's retained locked build log proves a successful build and
map `54a33f1054df7c3f`, but its HEAD/renderer-patch metadata does not enumerate
all compiled inputs amid concurrent edits. The earlier recovery claim of a
reproducible revision is therefore insufficient to establish complete source
identity. This investigation uses the explicitly recoverable fallback:
module SHA-256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`
with all **292 exact matching files** from
`20261031T0403Z-revolt-backbuffer/source-after/`, copied into this run and
individually verified. The source manifest SHA-256 is
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`.
The retained successful `build-after.log` supplies build provenance; there
is no claim that current HEAD compiled this module. All 1,374 original
Pirates input hashes passed before launch. Host source requests are confined
to the saved source tree, with separately frozen supporting fonts/icons.

The prepared observer distinguishes geometry `+0xb4` property state from
`+0xb8` effect state, records renderer `+0x14` and raw property slots
`+0x18/+0x28`, and retains wrapper/object/map words. It records prepass EAX
at `0x5c42c2` before selecting a later breakpoint; a nonzero return skips
`0x5c4375`. A synthetic helper smoke test passes zero/nonzero return paths,
bounded stopping and original-instance restoration; this is not live guest
evidence. The corrected observer caps each thread at four complete meshes,
240 hits or 30 seconds. Original-EXE excerpts additionally identify object `+0x10` as
entry count and `+0x14` as `0x18`-byte entry storage at `0x5c9680`;
`0x5c96f0` copies separately indexed size/data pairs and `0x5c9560` retrieves
them. These raw structures do not establish shader identity or valid texture
consumption.

**Live result:** one browser followed the native Main Menu → bartender →
English captain → System Options → sailing route. `native-coast.png` was
personally inspected before helper installation: ship/HUD near St. Kitts
and Nevis, 600 gold, 41 crew, white coast. Natural simulation subsequently
docked at Nevis; native Sail away / No matter, cast off selections returned
to sea. `native-turn.png` shows changed ship/coast placement after an
800 ms Right input plus elapsed simulation. `final-sailing.png` shows the
ship offshore. This is native sailing progress, not a repair, voyage,
combat, save, audio or complete rendering qualification.

`third-boundary-export.json` contains **12 identity-checked records: four
complete same-mesh sequences** at `0x5c429e`, `0x5c42c2` and `0x5c4375`.
All four prepasses return EAX zero. At all three boundaries, geometry
`+0xb4` equals renderer `+0x10`; slots `+0x18` and `+0x28` equal the actual
attached NiRendererSpecificProperty and NiTexturingProperty pointers.
The effect-state pointers are captured separately. All four select
NiD3DDefaultShader and have geometry `+0xc8` zero. Therefore the attached
properties are **not lost between attachment and these effective-state
boundaries** in these samples. Null shader-extra does not establish a
missing property.

Three sampled mesh pointers also match actual large indexed draw
submissions in `consumption-export.json`: `0x09f179b0` / 1,392 triangles,
`0x09f15160` / 4,784, and `0x09f14c60` / 5,338, all FVF `0x112`.
The fourth boundary mesh lacks that draw correlation in the bounded capture.
Payload wrapper `+4` objects have two or three entries with retained size/data
pairs, including 2,880-, 12,128- and 40,048-byte buffers. No shader identity
is inferred from those buffers.

The ordinary seven map pointers at texturing-property `+0x2c` are zero in
all four boundary samples. The first seven sampled slots of the separate array at `+0x44` contain five
non-null entries; `map-arrays.json` preserves its actual data-pointer
indirection and raw descriptor words. This is a bounded prefix, not the total
array occupancy: its retained headers have ends 9, 7, 11 and 11. This does not prove valid texture
contents. `consumption-final-export.json` supplies two same-mesh consumer
records for `0x09f179b0`: default setup `0x5d458a` receives the matching
property state, and `0x5d4600` has UV count one while the ordinary map slots
remain zero. The attempted later map-load breakpoint and subsequent capped
probe supply no records; **actual downstream map loading/consumption remains
unverified**. The next causal work is why this geometry has empty ordinary
maps plus populated separate maps while using the default shader, and which
consumer is intended to use those separate maps. No renderer repair or
shader substitution is justified.

The first observer sequence is explicitly rejected for cross-boundary
comparison: its later EBP values belonged to different meshes because the
helper cleared the breakpoint before its one-block advance. The corrected
helper keeps that advance guarded, verifies mesh/renderer identity and
restores all instances/breakpoints on completion. A second installation
while in town found no matching meshes; that is not evidence of missing
properties. All attempts and limits are preserved in `RECOVERY.md`.

Crash sweep: Chrome stderr, page/worker events, CDP target/Inspector crash
events and 142 cheap process/memory samples cover the browser lifetime,
including a sample before launch. No page/CDP crash or page exception was
recorded; browser exit is zero. Peak sampled renderer RSS was 2,735,096 KiB;
summed RSS includes shared pages and is not unique memory. Cgroup memory
counters were unavailable. There is no new crash diagnostic, no established
cause for the earlier crashes, and no helper/OOM attribution. The controller
tool reported 143 after completed cleanup; its cause is unknown.

The runtime guard first refused to launch when UT2004's orphaned Chrome
remained alive despite its free lock; that browser was left to its owner.
Pirates launched only after the owner closed it and the process guard found
no conflict. Full-lifetime locking then covered the single Pirates browser.
Original inputs, exact source/module, all 467 served responses, 22 trusted
input events, helper syntax/control-flow and sequence identities pass the
retained checks. All owned browser/child/crashpad/controller/lock-holder/
watcher PIDs are absent, three ports closed, profile removed. No Boat or
assigned box was used (ID/state/expiry N/A); delegated local shutdown is
complete. This docs-only change has no new production build or code-fix
claim. The investigation and cleanup finished within the 30-minute bound.


### 2026-10-31 separate-map writer/consumer contract (05:20Z)

Evidence: `scratch/runs/20261031T0520Z-pirates-maps/`, including
`RECOVERY.md`, original-EXE disassembly, `writer-export.json`,
`consumer-export.json`, `identity-export.json`, `draws-export.json` and
`causal-validation.json`. This bounded follow-up establishes the original
writer and the encoded separate-map reader, with four matching generated
mesh/property pairs at the default setup boundary. It does **not** establish
the production source cause of white coast or a repair.

The run retains the exact `8459597c…` module, all 292 matching source files,
manifest `9dee97b3…`, historical successful build log and 1,374 original
input pins described above. Original EXE SHA-256 is
`6e88b90e4e2e30248d9e4de747b521cc03822b7ffeb214fd272b8ad1817447c9`.
No current host source was served with the old module.

The original application mesh builder at `0x51c490` constructs and attaches
NiTexturingProperty (`0x51c894–0x51c927`), then walks map definitions. At
`0x51cb19` it constructs a descriptor using the source texture reference;
`0x51cb27` stores the low-byte index at descriptor `+0x1c`.
`0x51cb35` calls `0x542cb0` with ECX = destination property and arguments
index/descriptor. That setter lazily creates the separate array and stores
it at property `+0x44` (`0x542ce9`); it does not populate ordinary `+0x2c`
slots. Array `+4` is data, `+8` capacity, `+0xc` end and `+0x10` non-null
count; original `0x5606f0` explicitly maintains those fields. The stream
reader at `0x542d70` also loads ordinary and separate arrays independently;
its separate-array allocation/store is `0x54300e` / `0x5430e7`.
Thus zero ordinary slots alongside populated separate slots can result from
an explicit original writer; it is not proof of lost property attachment.

The original consumer contract is equally explicit. `0x5cb4b0` masks its
stage object's encoded map reference with `0x0f000000`. Kind `0x02000000`
(`0x5cb59f`) selects property `+0x44` (`0x5cb5aa`), bounds the low 16-bit
index by array end, and calls getter `0x4b1230` at `0x5cb5be`. The getter
follows array `+4` to that indexed descriptor. Descriptor `+4` is then
passed through the renderer texture-resource resolver (`0x5cb620`) and the
result to the stage-binding virtual call (`0x5cb631`). Caller `0x5bef00`
walks pass stages, obtains texturing property from effective state `+0x28`
at `0x5bef2e`, and calls through `0x5cb790` to this consumer. A second
encoded-kind reader at `0x5e3d90` uses the same getter at `0x5e3e67`.
This establishes an original separate-map consumption interface, not the
identity of the shader/pass intended for these particular coastal meshes,
valid texture pixels, or successful live binding through that interface.

Before the native probe, the diagnostic boundary error was isolated using
only the retained module and copied original instructions `0x5d4600–0x5d465d`.
`block-smoke.cjs` passes with chaining on and off: branch target `0x5d465c`
positively halts after ordinary-map loads; interior instruction `0x5d462a`
does not halt. The pinned debugger checks EIP at decoded-block entry
(`source-after/src/13-exports.wat`, run-loop breakpoint check); its
`set_bp` does not reset `bp_skip_once`. The observer therefore retains the
old breakpoint during `run(1)` before retargeting and records the owning
instance/thread plus mesh, property, ESP and shader pointer. The synthetic
observer test verifies bounded capture, guarded advance and restoration;
these tests are not live gameplay evidence.

One browser, acquired only after UT2004's owner closed its browser and the
process guard found no conflicts, followed native menu/bartender/crew/
English-captain inputs into sailing. `system.png` and `native-coast.png`
were personally inspected: ship/HUD near St. Kitts and Nevis, 600 gold,
41 crew, white coast. The writer observer captured 545 post-call records
at `0x51cb3a`, on cooperative thread 5. Every stored descriptor equals the
argument retained in ESI. Four mesh/property pairs match later default
setup on the main instance:

| Mesh | Property | Separate end / populated | Matching large draw |
| --- | --- | --- | --- |
| `0x09de7f20` | `0x09de7d70` | 9 / 7 | 1,392 triangles, FVF `0x112` |
| `0x09de6e80` | `0x09de6cc0` | 7 / 5 | Not in bounded draw sample |
| `0x09de5730` | `0x09de5520` | 11 / 9 | 4,784 triangles, FVF `0x112` |
| `0x09de5f20` | `0x09de5d80` | 7 / 5 | Not in bounded draw sample |

For each pair, writer index/descriptor records exactly reproduce every
populated separate slot at the consumer boundary. All ordinary slots are
zero. Each has a complete same-instance, same-mesh/property/ESP/shader
sequence at `0x5d458a`, `0x5d4600` and **`0x5d465c`**. Effective property
state equals geometry `+0xb4`, its texturing pointer equals the actual
attached property, UV count is one, and the positive final branch has zero
ordinary-map registers and saved map locals. Shader RTTI independently
reads NiD3DDefaultShader (`0x083f6cd0`); geometry `+0xc8` is zero.
This proves that the sampled default setup reads the empty ordinary map
namespace. It does not prove that every subsequent render stage ignores
separate maps. No absent breakpoint event is used to assert skipped guest
execution. The previous five-entry observation was only a seven-slot
prefix; this capture reads each full bounded array end.

**Remaining dependency:** identify the original pass/stage selection or
construction that should produce `0x02000000 | index` references for these
same generated meshes, and establish its relationship to shader selection
at `0x5c4270`. Its relationship to the attached renderer-specific payload
is unproved. Neither the payload's shader identity nor the need to install
it at geometry `+0xc8` follows from these records. No production fix,
shader substitution, asset/guest-state/clock/startup change is justified.

The probe stopped after those correlations. Natural simulation docked at
Nevis before `final-coast.png` (personally inspected; a town menu, despite
the filename). All observer instances/breakpoints and the bounded draw hook
were restored before quit. Browser exit zero and all owned browser,
controller, lock-holder and crashpad PIDs/ports/profile are verified closed;
no Boat was used (ID/state/expiry N/A). Cheap stderr/process/crash diagnostics
are retained; no crash was reproduced and no OOM/helper cause is assigned.
Exact source/module, originals, served responses, trusted released inputs,
helper tests, instruction checks, four correlations and scoped evidence
references pass. This is a documentation-only result with no new production
build claim; the retained build log is historical provenance. Investigation,
cleanup and publication finished within the 35-minute bound.

## Coastal terrain selection and serialized stages (2026-10-31, 05:35 run)

The next dependency is now localized **before pass construction**: the
original application requests `TTerrain_*B_UC` for generated coastal meshes,
but the shader factory returns null. The renderer consequently selects
NiD3DDefaultShader. This establishes the requested shader family and the
immediate fallback cause; it does not establish the underlying source defect.
Evidence and runnable checks are in
`scratch/runs/20261031T0535Z-pirates-selection/RECOVERY.md`.

Original-EXE selection chain (all addresses are guest VAs):

1. Coastal cell rebuild `0x51cf40` calls its generator's virtual slot zero
   at `0x51d073`. Constructor `0x51c440` installs table `0x71289c`, whose
   entry is the already-proved mesh/property builder `0x51c490`. The
   returned mesh remains in EBP. After attaching it, rebuild obtains its
   texturing property, reads separate-array `property+0x44`, and loads the
   array's **populated count** at `+0x10` (`0x51d154`). At `0x51d161` it
   passes that count and the same mesh to manager `0x8cad50` virtual slot zero.
2. Manager table `0x710328` resolves this call to `0x4f0130` and its name
   selector at slot `+0x18` to `0x4efc50`. That selector formats
   `TTerrain_%dB_UC` when manager byte `+0x10c` is nonzero, otherwise
   `TTerrain_%dB`. Constructor `0x4f0230` derives that byte from bit zero
   of a device-query result (`not; and 1`). This static bit operation does
   not establish a capability-reporting defect. The measured requests
   positively establish the UC branch for this run.
3. `0x4f0130` calls `0x547730(mesh, name, 0)`, which delegates to factory
   virtual slot `+8`, `0x5be060`. This calls factory slot `+0x10`,
   `0x5bd720`, with name, implementation and report-failure flag. At the
   decoded-block continuation **`0x5be077`**, EAX is the selected shader.
   Null takes the error return without writing geometry `+0xc8`. A
   nonnull result proceeds through shader geometry setup at `0x5be0bd`
   and is installed at `0x5be0f6`; even a false setup result logs and
   continues to installation. Thus null lookup and failed geometry setup
   are distinct cases.
4. Renderer `0x5c4270` reads geometry `+0xc8` at `0x5c427e`, casts it to
   the expected shader type, and on null loads renderer `+0x898` at
   `0x5c4298`. The setup/cache path at `0x5c4080` makes the same choice.
   Empty `+0xc8` therefore explains the observed default shader without
   deriving a shader identity from the renderer-specific property payload.

The encoded stage references already exist in the original binary shader
assets. Original pass stage reader `0x5ed660` reads a count, allocates
stage descriptions, and invokes `0x5eeff0` at `0x5ed6f4`. The latter reads
a string, a uint32 into description `+4`, then the **serialized encoded map
uint32 into description `+8`** at `0x5ef023`, followed by two optional state
groups and the transform fields. During pass construction, `0x5ed955`
calls `0x5eef20 -> 0x5f0740`; `0x5f074e..0x5f0751` copies description
`+8` to runtime stage `+8`. `0x5ed962 -> 0x5bf1f0` installs the stage
at the loop's pass slot. This connects to the accepted
`0x5cb4b0 -> 0x4b1230` separate-map consumer. It is not necessary to
infer a new OR operation in this binary-pass branch.

A targeted decoder follows those original readers through complete stage
records, including state groups and transforms. It validates these stage
arrays in the unchanged `Assets/Shaders/FX/TerrainShader/*.NSB` files:

| Requested asset | Array starts (file offsets) | Encoded base-map references |
| --- | --- | --- |
| `TTerrain_5B_UC.NSB` | `0xbd0`, count 3 | `0x02000004..0x02000006` |
| `TTerrain_7B_UC.NSB` | `0xc44`, count 4; `0x109a`, count 1 | `0x02000004..0x02000008` |
| `TTerrain_9B_UC.NSB` | `0xc98`, count 4; `0x10ee`, count 3 | `0x02000004..0x0200000a` |

The original `terrain_11_uncompressed.nsf` agrees: texture attributes
`TerrainTextureBase0` onward use indices 4 onward. For 7B and 9B,
`TerrainSinglePass` uses the first four base textures and
`TerrainDoublePass` uses the remaining one or three; 5B uses three in
`TerrainSinglePass`. These are original definitions associated with the
requested names, **not observed runtime terrain passes**: creation failed
before a shader was returned. No claim is made about every later default
stage or about separate slots 0/1 from this targeted base-stage decode.

One bounded native probe, after the prior browser owner released the lock,
tested whether factory lookup actually returned a shader for these meshes.
It used exact module `8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`
and its retained 292-file source snapshot (manifest
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`).
Served-source hashes and actual WebGLBackend identity are retained;
execution used the main/cooperative instances, with guest worker disabled.
The observer paired positive entries at `0x5be060` and `0x5be077`, checking
owning instance, stack displacement, saved mesh and name pointer. A
synthetic test of the original first block validated both chaining modes.
No writer capture or old interior-breakpoint observer was repeated.

All 66 captured `TTerrain_*B_UC` lookups returned null (implementation 0);
104 other shader lookups returned nonnull results. Nine distinct terrain
meshes match 21 later large draws by mesh **and identical property,
separate-array header and complete descriptor list**. All have empty
ordinary slots, null geometry `+0xc8`, and independently read RTTI
NiD3DDefaultShader (`0x083f6cd0`). Representative positive pairs:

| Mesh / property | Requested name | Separate populated | Later draw |
| --- | --- | --- | --- |
| `0x09e10410` / `0x09e101e0` | `TTerrain_7B_UC` | 7 | 1,392 triangles, FVF `0x112` |
| `0x09e0fb70` / `0x09e0f960` | `TTerrain_9B_UC` | 9 | 4,784 triangles, FVF `0x112` |

These are fresh run identities, not assertions that addresses match the
prior capture. `sailing.png` was personally inspected: ship/HUD by St.
Kitts and St. Eustatius, 600 gold, 41 crew, white coast. `native-coast.png`
shows system options and is not sailing evidence.

**Remaining dependency:** determine why `0x5bd720` cannot return the
requested UC terrain shader. Its static path checks the renderer/name,
queries the shader cache at virtual `+0x18`, then enumerates libraries at
`+0x34/+0x38` and calls library `+4` with renderer/name/implementation.
The captured null return does not distinguish registration, library lookup,
requirements rejection or shader creation/compilation failure. Trace that
factory/library decision next, retaining same-mesh identity; do not infer a
source cause from missing events or substitute another shader.

The 15 original instruction checks, complete targeted stage decodes,
nine correlations and a deliberately corrupted selected-pointer negative
control pass. All 1,374 original inputs and 292 saved source files match
before/after, including the served module and responses. All six observer
instances and draw hooks were restored. Browser exit zero; owned browser,
controller, holder, watcher and crashpad PIDs, three ports and profile are
verified closed. Cheap stderr/process/target diagnostics remain in the run;
no crash or OOM cause is assigned. No Boat was allocated (ID/state/expiry
N/A). This is documentation only, with no production changes or new build
claim; no source fix is justified by the current evidence.


## Original shader factory/library trace (2026-10-31 07:37 UTC)

Evidence: `scratch/runs/20261031T0737Z-pirates-factory/`, with recovery
instructions in `RECOVERY.md`. Static analysis precedes the single native
probe. This run references the retained `8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`
module and its matching 292-file source/compiler and frozen support closure
from `20261031T0535Z-pirates-selection`; it does not combine that module with
current host files. No production source is changed.

The original EXE installs factory vtable `0x6c70d0` in constructor
`0x5be670`. Its library registry is factory `+0x20`, iterator `+0x1c`;
registration virtual `+0x24` is `0x5be470`, first/next library virtuals
`+0x34/+0x38` are `0x5be570/0x5be5f0`. The registration callback
`0x500460`, installed at `0x5004ef`, routes `NSBShaderLib` to `0x5e7c90`
and `NiD3DXEffectShaderLib` to `0x5e0220`. Loader `0x5478d0` registers its
nonnull callback output through factory virtual `+0x24`.

`0x5e7c90` creates the NSB library through `0x5e8050`, installing vtable
`0x6c9a58`. Library virtual `+4` is `0x5e7eb0`: exact name search
`0x5e7e20`, then `0x5e9fb0(renderer, implementation)` on the matched binary
shader. That function checks the requested implementation at
`0x5e9ff7 -> 0x5e8a70`, tries suitable alternatives through `0x5e9bf0`,
then constructs and sets up the binary shader. Requirements failure and
later setup/compilation/API failure remain distinct. Original NSB header
names and hashes for all nine `TTerrain_2B_UC` through `TTerrain_10B_UC`
files are retained in `original-terrain-names.json`; no stage decode was
repeated.

The NSF references 16 distinct VS/PS program filenames; all 16 original
files exist under `Assets/Shaders/FX/DX9` and their hashes are retained in
`nsf-program-files.json`. This establishes disk presence, not successful
runtime resolution or compilation. The 15 original instruction checks and
factory/NSB vtable checks pass (`static-check.py`).

**Outcome: incomplete; no causal rejection or missing original dependency
established.** The one guest probe ran from 08:01:31 to 08:06:08 UTC with
default guestWorker enabled (five guest workers), explicit WebGL and a
stable 1024×768 viewport. Native Enter, Escape, Space and mouse input left
it at the title screen. The host slice setting was raised from 5k to 50k;
this changed the run budget, not guest state or clock. The five observers
captured zero factory calls, including zero skipped names. Clearing their
breakpoints during startup did not advance the title; all hooks were then
restored, and a final unhooked Enter/wait also remained at the title.
`unhooked-title-final.png` was personally inspected. The main worker was
still retiring blocks (50,000 in the final unhooked snapshot); this is not
proof of a shader or thread source cause.

Consequently, the selected **runtime** library/vtable and same-call terrain
name/requirements/API result remain unproved. The static NSB registration
chain above is not a runtime selection claim. `check-evidence.py` correctly
rejects the empty call trace; `check-outcome.py` verifies the static findings,
executor identity, restored observers, retained inputs and explicitly false
causal-discrimination result. It also rejects an unrestored-observer negative
control. No library null is labelled a source fix.

The accepted prior run's `sailing.png` was personally inspected: actual
ship/HUD, St. Kitts/St. Eustatius, 600 gold, 41 crew and white coast. Its
Threads box is unchecked. That is retained cooperative-run evidence, not
a fresh sailing frame from this default-worker probe. No property writer,
NSB stage decode or default-shader draw capture was repeated.

A preceding browser startup failed before loading any page/guest or
installing a probe: the harness compared a resolved frozen-source path
against its symlink alias and returned HTTP 500. Correcting that harness
allow check enabled the sole guest probe; `failed-startup/` preserves the
failure and cleanup separately. Both browser exits were zero.

Before/after checks pass for all 1,374 originals and 292 exact saved source
files including compiler sources. All 374 served responses and 106 source
URLs, plus the loaded module, match the frozen closure. All 18 recorded
inputs were trusted and no keys remain held. `cleanup-check.py` verifies
all observed owned processes absent, HTTP/CDP/control ports
`42137/36491/41127` closed and profile removed; failed startup ports
`36693/40615` and its profile/processes are also closed/absent. No Boat was
allocated (ID/state/expiry N/A). Documentation only; no production change,
new build, shader substitution or source-fix claim. Work stops here without
a successor; the requested causal result remains blocked by failure to
reach a factory call in the required default-worker execution.

## Default Worker title/startup boundary (2026-10-31 08:17 UTC)

Evidence: `scratch/runs/20261031T0817Z-pirates-worker-title/`; replay
instructions and scope are in its `RECOVERY.md`. The comparison uses the
same retained `8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`
module, `9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`
292-file source/compiler manifest and 40 frozen support files as both prior
runs. At initial comparison, seven current scheduling, loader and input files
also matched those retained sources. The accepted sailing route has Threads unchecked;
the factory run has default guestWorker enabled. Sailing remains historical
cooperative evidence, separately inspected from the title screenshots.

The prior factory console contains two concrete startup errors: Workers 6
and 7 fail `initGuestThread` because DLL module `0xaf1000` does not complete
reason 2 (`DLL_THREAD_ATTACH`). The main-thread samples are inside original
`0x5516a0` and `0x5007e0`, called by `0x4baaa0`. That original function loops
while resource-object field `+0x50` is nonzero, waiting on the job manager at
`0x8ca4e0` and pumping its queue at `0x8ca4c8`/current job at `0x8ca4cc`.
Manager creation at `0x5515a0` starts a suspended CRT thread, stores its
handle at `+0x1ac`, then resumes it; manager state is `+0x198`.
`static-check.py` pins eleven original instruction sites and eight source
contracts. These establish a resource-job wait, but alone do not establish
that either failed Worker owns the required job.

The source scheduling distinction is specific. `guest-worker.js` awaits
`notifyDllThreadAsync` before posting `threadReady`, including for a thread
created suspended. The asynchronous loader's noncooperative callback runner
stops on a blocking halt, restores the caller's frame and rejects incomplete
notification. `ThreadManager._spawnOnePendingWorker` then records the failed
thread as exited; `_spawnPendingWorkersPass` removes its pending entry.
Cooperative scheduling skips suspended threads before notification and uses
`beginDllThreadNotification` to retain the callback frame and scheduler
continuation between turns. This static distinction motivates the bounded read-only trace below;
static comparison alone does not justify a source fix.

The sole fresh default-Worker guest ran 08:43:46–08:46:17 UTC after the
foreign MedicalRoom lane was released. An earlier process-gate rejection
started no Pirates browser or guest. The full lifetime used the browser lock
and an actual process gate. Source responses, module and originals stayed on
the retained closure; explicit WebGL, 1024×768 and the shipped 5k slice were
unchanged. The page observer adds one host roundtrip before each thread-init
command; callback observations wrap the supplied `run` without changing its
budget, owning instance, registers or guest memory. No breakpoint, factory,
shader or property probe was installed.

**Causal scheduling failure reproduced.** Workers 6 and 7 enter original
`MSVCR71.dll` at load address `0xaf1000`, then park during reason-2 attach:
`halt=4`, `yield=9`, critical section guest `0xb3c190` (WASM `0x74e190`),
owner main thread 1. Their stack retains the EnterCriticalSection return and
argument. The loader restores the caller and rejects notification immediately.
The same section is subsequently free, so the failed attach was a temporary
wait, not evidence of an unreleasable original dependency.

Worker 7's CRT parameter names game entrypoint `0x551550`, argument/job manager
`0x83f3e40`, handle `0xe1007`, state 1 and filename
`fx_ship_bowfroth.nif`. At that failure the manager and current-job pointer
`0x9704a10` match the main Worker. Later snapshots retain that current job,
with the thread exited code 1 and manager state 0; main executes `0x4baaa3`
with resource `0x8dd640` field `+0x50` still nonzero. The manager's name buffer
later contains `bullet_down.nif`; that later string must not be substituted
for the filename captured at attach failure. Original `0x551550` calls the
load virtual then completion virtual `+0x1c` (`0x500730`); dropping the thread
before its entrypoint prevents that completion path. `0x5007e0` will not
dequeue another job while the current-job pointer remains set.

A single targeted native Enter has trusted down/up events. Before and after,
`takeInput` has zero calls and its key/character/release messages remain in
the renderer queue. This is a pre-input resource-job stall. Both fresh title
screenshots were personally inspected, with five Workers enabled. Worker 6
was pending suspended at observation; Worker 7 had already been resumed.
Consequently merely deferring suspended creation is insufficient to address
the observed second failure.

The source repair adds an asynchronous blocking-wait continuation to DLL
thread notification. The owning Worker recognizes the live CS argument,
waits without executing guest code until the owner word changes, verifies
unchanged EIP/ESP/yield, clears that wait and lets the original guest handler
retry acquisition. The callback generator, saved caller, DLL gate and mapping
pins remain owned throughout. Unrelated waits and synchronous incomplete
callbacks still fail. Workers remain enabled. The two callback-inventory
entries retain `ownership: pending` with an explicit lifetime review; no build
validation was removed.

`test-worker-dll-critical-section.js` exercises the shipped notification path
and Worker resolver with deterministic interpreter exports: retained frame,
no guest retry while held, asynchronous release, caller restoration, stale
frame/argument rejection and unsupported waits. It passes on the repair and
rejects the exact retained old loader. The full locked build, 58 Worker
scheduler checks, ThreadManager checks and callback-inventory mutation tests
pass. An additional native serialization test never started: it waited behind
the next foreign browser and its own queued lock was canceled. No pass is
claimed for it. `check-cause.py` passes and rejects three corrupted causal
controls (owner, completion and current job).

This proves and fixes the generic callback scheduling failure; **patched
Pirates startup/sailing is not runtime-verified** within the one-probe limit.
The retained cooperative sailing frame remains a separate historical result.
All 1,374 originals, 292 frozen sources, 374 served responses and 106 source
URLs match, including the loaded module. Four native events are trusted,
no keys remain held and page/Worker observers are restored. Browser exit zero;
all 71 observed owned PIDs are absent, ports `38077/38443/45869` closed and
profile removed. No Boat was allocated (ID/state/expiry N/A). Recovery and
small replayable evidence remain in the run directory. No successor is
started by this worker.

## Fresh default Worker replay after 81f47554e (2026-10-31 08:58 UTC)

**Startup remains blocked; no fresh sailing or gameplay is claimed.** The
repair retains the contended DLL callback, but the host prevents its lock
owner from running until worker bootstrap finishes. The subsequent bootstrap
timeout terminates that callback owner and leaves the DLL callback gate held.
This is the first remaining host dependency, before ordinary title input.
Evidence and replay checks are in
`scratch/runs/20261031T0858Z-pirates-patched-default/RECOVERY.md`.

Preparation stayed static while Deus durable owned the lane. After its
explicit 09:30:57 release, the sole guest ran 09:31:35–09:35:06 under a
detached wrapper and monitor holding `/tmp/wine-browser.lock` for the entire
controller/browser/cleanup lifetime. The actual Chrome, crashpad, heavy CLI
and live-profile gate was clear. The maximum was 18 minutes; this guest
stopped after approximately 3½ minutes once the dependency was established.

This uses the **fresh canonical** `build/wine-assembly.wasm` produced by the
existing successful 08:50 locked build, SHA-256
`d2c1df73d975daa4e7425152fb900274ebd9552c5a689249415084cfe8ac026b`
(1,898,571 bytes), with current repaired source at `81f47554e`. The complete
296-file runtime/compiler snapshot has manifest SHA-256
`c12552b31fcdbd6808ae8bd7f1bb35a5ed5315025ce12f8a4711964fdd4f08f3`;
40 current support files are separately frozen. The module was served through
a hardlink to the canonical artifact; after cleanup, the one 1.9 MB retained
image was detached and hash-verified so a later build cannot overwrite it.
The loaded response is hash-only, with no second module capture.
This does not reuse retained `8459597` with current host files. All 352
served responses and 106 source URLs, including the loaded module, match
their frozen bytes; all 1,374 originals match before and after.

Execution uses default guest Workers, explicit WebGL, 1024×768 and the shipped
5k slice. The bridge reports backend/device kind `webgl`, seven submitted
and completed operations and no queue error; GPU class/context-loss fields
were unavailable in this worker-backed identity query. The read-only attach
observer forwards the unchanged owning exports and run budget, with one page
roundtrip before each thread-init command. That adds host timing. No factory,
shader, property or breakpoint probe was installed, and no guest, original,
clock or INI was changed.

The causal sequence is recorded directly:

1. Slots 1–5 complete reason-2 DLL notifications. Slot 6 enters original
   `MSVCR71.dll` attach and parks at `halt=4`, `yield=9`, guest critical
   section `0xb3c190` / WASM `0x74e190`, held by main thread 1. Its live
   stack retains the original EnterCriticalSection argument and return.
   The repaired loader preserves this frame instead of rejecting it.
2. This is pending handle `0xe1006`, `CREATE_SUSPENDED`, suspend count 1.
   CRT parameter `0x8d4a6c0` names game thread entry `0x4fac80` with argument
   `0x8d4a760`; it is not the prior run's `0x551550` resource-job thread.
   Main is at original CRT `0xaf3139`, immediately after EnterCriticalSection,
   ESP `0x74ffd54`. Two snapshots 10,366 ms apart retain main slice sequence
   8980, the same registers, pending child and lock ownership.
3. The frozen host awaits `threadManager.spawnPending()` before the next
   main slice. `runWorkerSlices()` also awaits pending spawns. The single
   spawn pass awaits `spawnThread()`, which awaits `initGuestThread()`;
   that command awaits all DLL notifications before sending `threadReady`.
   Thus the creator cannot release the CRT lock while the child waits for it.
4. At 09:32:16.968, 30,003 ms after attach began, the host reports
   `worker 6 did not answer initGuestThread in 30000ms`. The failed-bootstrap
   cleanup drops the worker. Its callback never reports success or failure;
   the scheduler records handle `0xe1006` exited with code 1 and a stopped
   link. Slot 6 is absent from the live link inventory.
5. Main then advances and the CRT lock becomes free. However, two later
   snapshots retain the shared DLL callback gate at **owner 6, depth 2**,
   with generation pins on MSVCR71, binkw32 and OLEAUT32. Main is parked at
   LoadLibraryA thunk `0x7500180`, return `0x614179`, requesting `d3d9.dll`.
   Original call `0x614173` and the shipped LoadLibraryA handler's callback
   gate check explain this yield-9 retry. This is an orphaned host callback
   gate, not evidence that the original DLL or shader asset is missing.

One targeted trusted Enter down/up leaves three renderer messages queued;
`takeInput` remains at zero polls before and after. No additional key sweep
was attempted. The resource manager's current-job and queue are empty in
later samples, but that does not establish completion of all startup jobs:
execution has not reached ordinary input or the later resource-worker
boundary. Fresh title screenshots were personally inspected. The 05:35
cooperative sailing screenshot was also inspected and remains historical.

The next generic repair must let the creator and existing threads run while
a new thread's attach continuation is blocked, preserving single-flight
bootstrap and suspended-thread semantics. Failed bootstrap must also retire
the notification's frame, gate and pins before terminating its Worker.
Increasing the timeout alone would retain the dependency cycle. No production
change or patched-game success is claimed by this documentation-only run.

`check-cause.py` verifies the sequence and rejects five corrupted controls
(creator progress, CRT ownership, callback ownership, live worker inventory
and consumed input). Fourteen original instruction checks, seven repair
contracts, observer fidelity, module/source/support/original pins, served
hashes, trusted released inputs and focused documentation diff checks pass.
No new build was necessary. Page wrappers and all surviving Worker observers
are restored; slot 6's observer ended with its timed-out Worker. Browser and
launcher exit zero. All 41 observed owned PIDs, three ports
`37547/46669/44117` and the profile are verified closed/absent. The monitor
ended without emergency termination. No Boat was allocated (ID/state/expiry
N/A), the lane is released, and this worker starts no successor.

The coordinator identified a monitoring limitation during this run: Chrome's
flattened command line defeated the monitor's exact-argv profile matcher.
Its empty `profilePIDs` arrays are not cleanup proof. The original monitor
is preserved; the independent process-tree/profile command capture and final
PID/port/profile checks establish actual cleanup. The ignored recovery monitor
and gate now match the exact bounded profile token in both NUL-separated and
flattened commands, and validate PID start time plus command hash before
signals. Captured commands from ten owned Chrome processes reproduce the old
false negative and pass the corrected matcher; four token-boundary controls
and a changed PID-start identity are rejected. A later read-only gate check
correctly rejects the new foreign Deus light-exit runtime. No guest was
restarted, no foreign process was signaled, and the corrected monitor has
not been tested against another live Pirates runtime.

## Generic bootstrap creator progress (2026-10-31 09:53 UTC)

The independently safe creator-progress repair starts asynchronous Worker
bootstrap without awaiting it in the browser main loop or Worker scheduler.
The creating thread and existing runnable Workers retain their ordinary slices
while DLL_THREAD_ATTACH waits. Explicit readiness callers can still await
`spawnPending()`. The pass remains single-flight, including synchronous backend
reentry and threads appended during an await; unexpected background errors are
observed once and delivered at the next scheduler boundary.

Running the creator also permits TerminateThread during pending attach. That
request now retains its exit intent without signaling the handle or releasing
locks owned by a live callback. Once attach unwinds, the scheduler retargets
aliases to the completed record and retires its real Worker link before any
user slice. CREATE_SUSPENDED remains effective throughout and after attach.

`test-worker-bootstrap-progress.js` drives the shipped host loop, ThreadManager,
DLL notification generator and Worker critical-section resolver with controlled
interpreter exports. Creator-owned and existing-thread-owned locks release,
attach completes, both callback gate scopes unwind, and suspended user entry
receives no slice until ResumeThread. It also covers multiple pending threads,
backend reentry, pending termination through an alias, failed-link stack
ownership and background metadata failure. The exact retained old host rejects
the creator case and old ThreadManager rejects the existing-thread case, both
at the held-lock dependency rather than a missing import or API. Existing
scheduler fixtures explicitly await readiness; all 58 assertions are retained.
Evidence and commands are in
`scratch/runs/20261031T0953Z-pirates-bootstrap/RECOVERY.md`.

**Failed-bootstrap callback retirement remains unresolved.** Notifications run
outside the scoped-loader transaction registry. WorkerLink.stop only asks for
scoped-loader retirement when that registry was used; it has no endpoint-owned
notification cancellation/acknowledgment. A safe repair must fence new commands,
unwind the actual nested async generators/gate scopes, settle lookup and RPC
continuations, and preserve generation quarantine and stack leases before
termination. The current notification error path deliberately retains the
unfinished image's quarantine pin; blindly decrementing every pin would be
unsafe. This change adds no gate reset, callback skipping, guest patch or
timeout increase. It fixes the scheduling cycle, without claiming that a
separate timeout/error can no longer orphan callback ownership.

The focused causal regression, scheduler, ThreadManager, scoped-loader
retirement and callback census/mutation checks pass. An additional
`test-thread-retired-stack-lease.js` check fails in its pre-existing incomplete
fixture (`_authorityEvents` missing at closeSyncHandle); the exact retained old
ThreadManager reproduces that same failure. The fixture is unchanged.
Native replay outcome will be recorded separately; these source tests do not
establish fresh sailing or input progress.

### Fresh default Worker replay of 9b1126f01

**Fresh native sailing is now observed with default guest Workers enabled.**
The sole local guest ran 10:02:34–10:10:27 UTC, under eight minutes, after the
explicit Deus lane release and a clear actual Chrome/crashpad/heavy-CLI/profile
gate. The detached wrapper held `/tmp/wine-browser.lock` through browser,
monitor and cleanup. No second guest or successor was launched.

This uses the newly built canonical module SHA-256
`d2c1df73d975daa4e7425152fb900274ebd9552c5a689249415084cfe8ac026b`
with repaired source commit `9b1126f019dba2005f40773393076f59d4cde3f2`.
The unchanged WAT produces the same module bytes as the previous canonical
build; the host and ThreadManager are the new repair. All 296 frozen source
files, 40 support files, 1,374 originals and 2,112 served responses / 106
source URLs match. The complete source manifest SHA-256 is
`f3890c7f0ec55c6bc9633495f3929400cfcafd9556305c59f9c24a6a3b1d8e3b`.
The loaded response hash matches the fresh retained module. The prior run's
read-only attach observer is retained, including its per-init host roundtrip;
it changes timing and does not change guest instructions or callback budgets.

All **135 reason-2 attach notifications complete**, including slot 6. No
bootstrap timeout or notification failure occurs. Main advances through the
resource-job startup, consumes the queued trusted Enter and reaches the main
menu. Native navigation continues through Crew Signups, bartender, captain
selection, the English captain's welcome, St. Kitts and its Sail away / cast
off choices. The final snapshots have no pending spawns, callback gate
`[0,0]` and zero pins on all 14 live DLL lifecycle rows. This demonstrates
normal callback completion; it does not test failed-bootstrap retirement.

Personally inspected `19-world.png`, `20-turn-left.png` and
`21-final-sailing.png` show the ship and sailing HUD, the St. Kitts/Nevis
coast receding, and the date advancing January 9 → January 12, 1660. A trusted
Numpad-4/ArrowLeft down/up is consumed as WM_KEYDOWN/UP VK_LEFT. The final
snapshot records 93 input polls; all 32 native events are trusted, and no key
or mouse button remains held. No quantitative turn-rate, FPS, combat or broader
rendering-correctness claim is made. The final bridge reports WebGL device
kind, 126,574 submitted / 126,573 completed operations and no queue error;
GPU class and context-loss fields remain unavailable through this identity query.

One harness limitation is explicit: a cache-control Puppeteer connection
temporarily reset the viewport to 800×600. The original driver still captured
1024×768 screenshots, so those intervening screenshot coordinates were not
reliable click coordinates. The mismatch was diagnosed from actual DOM bounds
and restored at 10:06:07 with no guest restart. Captain/world navigation and
the final identity run at verified 1024×768. Cache clearing/disabling was used
to preserve the disk floor; minimum sampled free space was 2,030,845,952 bytes.
No guest file, game INI or interpreter clock was changed.

The evidence verifier passes and rejects four corrupted controls: unfinished
slot-6 attach, orphan callback gate, retained pin and zero consumed input.
The corrected profile matcher detects live flattened/NUL command lines and
uses PID-start/command identities, including the referenced crashpad. Browser,
controller and wrapper exit zero; all 66 observed owned PIDs are absent, ports
`33425/45119/33045` closed, profile absent and the full lock released. The
post-cleanup actual-process gate was clear before releasing the lane; no
emergency or foreign signals were needed. No Boat was allocated (ID/state/
expiry N/A). Recovery, raw traces, original-source rejection logs and bounded
replay commands remain in `scratch/runs/20261031T0953Z-pirates-bootstrap/`.

### Failed-bootstrap notification retirement, 2026-10-31

The remaining notification ownership boundary above now has a generic source
repair. This task does **not** replay Pirates: the accepted native sailing and
input evidence remains the preceding 9b1126f01 run. The new evidence is local
correctness testing of the failed path, rather than another normal attach.

Each Worker binds its actual exports to an endpoint-owned DLL callback owner.
That owner tracks asynchronous gate scopes and callback generators, including
nested LoadLibrary initializers whose options do not carry the outer thread
notification's wait resolver. A retirement control message validates endpoint
identity and bypasses the blocked command queue to fence admission, reject
pending DLL lookups and signal cancellation. The critical-section wait checks
that signal without executing the guest or clearing the unresolved wait.
Retirement then **joins the real command queue**: nested service calls must
return, callback generators close through `finally`, and their own gate scopes
release before the endpoint can produce its receipt. The existing scoped-loader
registry is retired as part of that same acknowledgment.

Cancellation produces an incomplete callback outcome, allowing the actual
mapping iterator to roll back its transaction. It never reports that DllMain
completed. Notification/lookup pins release by their captured generation;
failed notification pins remain reachable until endpoint retirement can release
them. An unfinished DLL_PROCESS_ATTACH keeps its distinct mapping quarantine
pin. Generation cleanup faults refuse acknowledgment, and an unresponsive
Worker retains its endpoint, gate, pins, stack and slot for an explicit retry.
There is no shared gate reset, blanket pin decrement, guest patch, callback
bypass, Worker disabling or timeout increase.

WorkerLink fences new requests and settles pending ordinary requests as soon
as retirement starts. It still serves an already inflight synchronous RPC:
otherwise that Worker's Atomics.wait could prevent cancellation delivery.
Lookup replies carry endpoint identity; stale replies and late bytes cannot
publish into a retired endpoint. The Worker reports stack allocation before
fallible TLS setup/attach, so failure without `threadReady` still transfers the
stack lease to the host. Existing ThreadManager barriers require acknowledged
Worker termination and a successful native stack free before slot reuse.
Neither host.js nor ThreadManager needed a source change for this repair.

`test/test-worker-bootstrap-retirement.js` runs the production Worker queue,
loader, LoadLibrary mapping iterator, RPC broker and scheduler retirement over
deterministic interpreter exports in actual Node Workers. It covers nested
attach cancellation in both a critical-section wait and a second DLL lookup;
failure before attach and inside a nested initializer; the actual bootstrap
request timer; pending ordinary requests; real inflight synchronous RPC;
stale endpoint replies/control and DLL generations; lost acknowledgment;
an endpoint unable to service cancellation while blocked in RPC; exactly-once
generator unwind; the acknowledgment/Worker-exit gap; a busy native stack lease;
cancellation while another endpoint owns the gate; and ordinary successful
nested attach with caller registers restored. All owned fixture Workers exit.

The causal retained-source control compiles the exact original WorkerLink at
its production filename with real sibling imports. Its older lookup reply
envelope receives only the current endpoint-identity field in the test transport,
so both variants reach the same genuine nested callback. Original stop/admission/
handshake code is unchanged. It actually terminates the Worker with gate
`[6,4]`, provider pins 2 and unfinished mapping pin 1, then fails the orphan-gate
assertion. The repaired path has gate `[0,0]`, provider pins 0, mapping pin 1,
and a real receipt recording two generators/two unwinds. This rejection is
ownership leakage, not a missing import, changed reply schema or absent API.

Bootstrap progress, all 58 scheduler checks, ThreadManager, critical-section
notification, scoped-loader retirement, scoped DLL lifecycle, thread-send
ownership, browser Worker slice/suspend/input source checks and affected callback
census/mutation checks pass. The extra retired-stack fixture still fails before
its own assertions because its Object.create fixture omits `_authorityEvents`.
The retained pre-repair ThreadManager reproduces that same failure; the fixture
is unchanged. The new regression independently checks the full acknowledged
exit/busy-free/retry stack lease path without weakening those old assertions.

Run evidence and reproducible commands are in
`scratch/runs/20261031T1022Z-pirates-retirement/RECOVERY.md`. After the Deus
camera worker explicitly released the lane at 10:54:06 UTC, the full build
passed at 10:55:16 under the browser lock followed by the build lock. Actual
Chrome/crashpad/heavy-process/profile gates were clear before and after; free
disk remained above 2 GB. No browser/native replay or Boat allocation is part
of this task. Unresponsive endpoints and unfinished initializer images retain
their respective quarantines; reclaiming arbitrary guest-owned locks is outside
this local correctness repair.

## Native terrain factory rejection: stale stream cap (2026-10-31 11:00 UTC)

Evidence and recovery: `scratch/runs/20261031T1100Z-pirates-terrain/`.
**The original factory's first rejection is now identified:** its NSB shader
packing requests four vertex streams, but the renderer copied a reported
`MaxStreams` of one. Original `0x5d74c0` returns null before creating the
vertex declaration. This is a capability mismatch with the existing generic
sixteen-stream implementation. The source correction advertises sixteen;
a fresh native replay of that correction remains outstanding, so white-coast
visual acceptance is still **PIRATES-TERRAIN-REVIEW**.

This was one functioning default guestWorker/WebGL run, not a title-only probe.
The fresh canonical build and current runtime/compiler/support snapshot were
frozen before launch. Its source includes `c6fa4878a` retirement and the later
`f1a3e1333` documentation commit; native module SHA256 remains
`d2c1df73d975daa4e7425152fb900274ebd9552c5a689249415084cfe8ac026b`
because that intervening work did not change WAT. It was rebuilt here, not
retained from an older module with a current host. Before/after checks cover
296 source/compiler files, 40 support files and all 1,374 originals. All
2,112 served responses and 106 source URLs match those frozen inputs.

The read-only observer followed three calls on actual Worker slot 6 from
factory entry `0x5bd720` to saved continuation `0x5be077`, validating
`ESP = entry ESP + 16`. Each retired step remained one decoded block;
registers, original data and guest clock were unchanged. All three requested
implementation zero with report-failure one:

| Requested shader | Mesh at factory entry | Factory result |
| --- | --- | --- |
| `TTerrain_10B_UC` | `0x09e92120` | null |
| `TTerrain_8B_UC` | `0x09e93040` | null |
| `TTerrain_7B_UC` | `0x09e91790` | null |

Each complete same-call trace positively establishes:

1. Renderer/name validation passes; cache result at `0x5bd76d` is null.
2. Registered `NSBShaderLib`, vtable `0x6c9a58`, is enumerated. Its exact-name
   lookup returns a nonnull binary shader at `0x5e7eba`.
3. Implementation requirements `0x5e8a70` return **one** at `0x5e9ffc`.
   Platform/version predicates pass; there is no failed requirement here.
   Runtime construction proceeds through `0x5ea04e`.
4. Packing conversion `0x5ec050 -> 0x5eede0` calls `0x5d74c0` with renderer
   `0x01144c84`, three packing entries and **four streams**. The factory
   loads renderer `+0x454`; at rejection block **`0x5d74d4`**, EDI is four
   and EAX is one. Original `0x5d74d2` branches to allocation only when
   unsigned requested streams are at most that limit.
5. `0x5eee1b` and `0x5ea1f5` positively observe null. The original diagnostic
   identifies failure to convert the packing definition to
   `NiD3DShaderDeclaration`. NSB returns null, then
   `NiD3DXEffectShaderLib` also returns null, enumeration ends, and the
   original factory returns null to its saved caller.

The cap transfer is explicit in original instructions:
`0x5c09fb` loads renderer `+0x700` and `0x5c0a12` stores it at `+0x454`.
The D3DCAPS9 destination starts at renderer `+0x644`, so `+0x700` is caps
`+0xbc` / decimal 188 (`MaxStreams`). The native saved caps and subsequent
read-only renderer snapshot both contain one. Shipped
`src/09ad-handlers-d3d9.wat` still stored one at that offset, although its
stream table, declaration validator and draw gathering already handle indices
0–15. This identifies the source of this rejection without inferring shader
compilation failure or missing original files.

The production change only updates that generic cap to sixteen. The existing
multi-stream test now queries actual device caps and verifies the last
advertised stream, index 15, draws exactly the same pixels as the interleaved
and stream-1 controls. Its unbound-stream rejection and index-16 rejection
remain intact. The existing WebGL pipeline cap expectation is updated to
sixteen; that browser test received syntax validation only in this task,
which permits one native browser lifetime. No additional native run was made.

Focused causal check `caps-causal.cjs` compiles the exact frozen old caps
source through the canonical compiler: it reports one and rejects the actual
four-stream packing predicate. Current source reports sixteen and passes.
The multi-stream pixel regression, adapter/device query regression, callback
ownership census and census mutation checks pass. Full
`flock /tmp/wine-build.lock bash tools/build.sh` passes while the browser
lifetime flock is also held. Fixed-source/module identity is retained in
`fixed-build-identity.json`; this is separate from the pre-fix native inputs.
No callback assertions, timeout, worker selection, assets or INI were changed.

Native navigation followed Crew Signups, bartender, English captain, St. Kitts,
Sail Away and cast-off into sailing. `18-coast-input.png` was personally
inspected: ship/HUD near St. Kitts/Nevis, white coast, 600 gold, 41 crew and
January 15. Numpad4 trusted down/up reached guest VK_LEFT; all 34 input events
are trusted and keys/buttons are released. The later draw sample contains
24 actual `0x5c43b7` draw boundaries, including 11 coastal records with
populated separate maps, null shader-extra and `NiD3DDefaultShader` (examples
1,392 and 4,784 triangles). **These later meshes were regenerated:** their
addresses do not intersect the three initial factory meshes. This is a native
coast/default-draw observation in the same execution, not a new same-mesh
factory-to-draw correlation. Historical accepted correlations remain separate.
`13-native-coast.png` is a town menu; `16-sailing.png` includes a tutorial
popup. Neither is substituted for the inspected final sailing frame.

Timing limitation: factory stepping and the inherited per-init host roundtrip
change execution timing. Slot 6 records 2.683 seconds inside the run wrapper,
including ordinary guest execution; this is an upper bound, not measured
incremental observer overhead. The draw observer was installed twice because
its first bounded window saw the town/menu interval and captured no qualifying
coast records. Its second window auto-restored after 24 draws. A final duplicate
stop logs a spurious `changed holder` warning in the temporary helper, which
lacks an idempotent stop guard. The prior export proves it already stopped with
no errors; records are unchanged, all final breakpoints are zero, and every
observer is stopped. This diagnostic limitation is preserved and checked.

Runtime was 11:01:25–11:06:32 UTC; normal cleanup completed 11:06:39, with no
monitor emergency signals. All observed owned processes, controller/wrapper,
monitor and watcher are absent; HTTP/CDP/control ports `33609/33287/42041`
are closed and the profile is removed. Actual global Chrome/crashpad/heavy-CLI
and profile gates are clear, and the full browser flock is available after
serialized build/tests. Full lane release was posted at 11:08:52. No foreign
process was signalled. Minimum sampled free disk was 2,068,365,312 bytes;
only this run's downloaded Chrome component caches were removed to maintain
the 2 GB floor. Browser cache was disabled without reconnecting or changing
viewport. No Boat allocated: ID/state/expiry N/A.

`verify.py` checks identities, all three causal traces, four deliberately
rejected trace mutations, native input, later draw limitations, exact originals
and cleanup. **Next dependency:** one separately authorized fresh matched
native replay must determine whether the corrected cap lets the original
terrain declaration/shader finish, and whether the coast textures render.
This task establishes and repairs the first causal rejection; it does not
claim that all later original declaration/program/pass paths now succeed.

## Cap16 native terrain and textured coast accepted (2026-10-31 11:17 UTC)

Evidence/recovery: `scratch/runs/20261031T1117Z-pirates-cap16/RECOVERY.md`.
**The fixed native original terrain factory succeeds, and the coast now renders
textured green/rocky land and beaches.** This is a fresh default guestWorker,
WebGL, 1024×768 session using the cap16 module and current retirement code.
No additional production change was needed. The native result advances beyond
the earlier static cause/focused regression result.

Reuse was conditional on exact closure, not merely the commit name: all 296
current source/compiler files match the prior canonical full-build snapshot
plus its exact committed repaired fragment. The compiler files and build log
are pinned in `build-reuse-closure.json`. The newly frozen current source,
40 support files and all 1,374 originals match before/after. Module SHA256 is
`078d81cba6ab755d6a05e5e234a259df9e867ecc8848899705a45739fab0e9a9`;
the served/loaded module matches. There is no retained old-module/current-host
combination. The earlier cap16 full build and pixel regressions are reused,
with exact source/compiler identity checked; no additional full build or
heavy CLI ran alongside the browser.

The read-only factory observer ran on Worker slot 6 and followed each saved
continuation `0x5be077`, with return ESP exactly entry ESP + 16 and no step
exceeding one decoded block. Its three bounded calls are:

| Requested original shader | Entry mesh | Returned shader | Path |
| --- | --- | --- | --- |
| `TTerrain_8B_UC` | `0x09de1780` | `0x09de13a0` | NSB construction |
| `TTerrain_9B_UC` | `0x09de34b0` | `0x09de4f70` | NSB construction |
| `TTerrain_9B_UC` | `0x09de5cd0` | `0x09de4f70` | Factory cache hit |

Both newly constructed calls find the exact original NSB name and pass
requirements. Their packing requests still need four streams; actual native
D3DCAPS9 `+0xbc` and renderer `+0x454` now contain **16**. Neither visits the
old reject block `0x5d74d4`. Packing conversion returns declarations
`0x09de2800` / `0x09de4720`, and NSB and the outer terrain factory return
nonnull shaders. The third call positively reuses the second result through
the factory cache. This run does not separately replay the prior run's
`TTerrain_10B_UC` or `TTerrain_7B_UC` names.

The later native draw observer records 24 actual `0x5c43b7` boundaries on
Worker slot 0, all `NiBinaryShader`, with shader-extra equal to the selected
shader and populated separate material maps. Triangle counts range from
504 to 4,424. One selected shader is `0x09de4f70`, the same shader object
returned above. **Entry meshes and later draw meshes differ**, and creation
and drawing occur in different Workers. This proves shared shader identity
and actual later material selection; it is not same-mesh or same-Worker
factory-to-draw correlation.

A separate bounded read-only bridge observer records 48 qualifying submitted
commands in that sailing interval. Thirty-one have both original programmed
shader stages, textures and successful issue result 1; recorded 512×512
texture pixels include `[66,117,8,255]` and `[55,106,3,255]`, with nonwhite
mip levels. These command records are not assigned mesh IDs from another
Worker's registers. Personally inspected screenshots `16-town.png`,
`23-trusted-turn.png`, `25-onward-sailing.png` and `28-onward-coast.png`
show green terrain, rock, beaches and moving ships, rather than accepting
camera labels alone. `16-town.png` is actually the initial sailing view;
its filename is not evidence of a town menu. Screenshot `18-current-coast.png`
is the actual Antigua town menu.

Native input followed Crew Signups, bartender, English captain, the arrival
town, Sail Away, Cast Off and tutorial dismissal. This unchanged run selected
**Antigua**, rather than the earlier St. Kitts starting town; that route
variation is preserved, not forced by editing assets/INI/clock. Trusted keypad
steering then moved the ship onward, triggered the Montserrat landing-party
prompt (`25-onward-sailing.png`), declined landing, and passed another sailing
ship whose native speech names St. Kitts (`28-onward-coast.png`). That speech
is not proof that the player has arrived at St. Kitts. No combat encounter or
St. Kitts town arrival is inferred from those frames.

The temporary draw-stop helper is repaired only in this NEW scratch run:
repeated stop returns already-stopped without clearing another observer's
breakpoint or reporting a changed holder. Actual repeated stops leave every
observed breakpoint zero and every draw observer stopped with no errors.
Factory instrumentation retains the original three-call/500,000-block cap;
per-init read-only host roundtrips and decoded-block stepping change timing.
Factory run-wrapper time includes normal guest execution and is not measured
incremental overhead. The texture wrapper saw 8,815 command calls, retained
only 48 qualifying records, and measured approximately 5 ms of its own
snapshot work; it restored itself at its record cap. Remote observer request
counts and complete timing are retained with the run's focused checks.
No guest registers, shaders, callbacks, timeouts, worker selection, clock,
original assets or protected Laptop/Heroes II/fonts were changed.

Observer accounting: 49 total control requests, including 11 Worker-evaluation
requests and eight page evaluations, plus 135 init-observer host roundtrips.
Slot 6's factory run wrapper totals 3.295 seconds, including normal execution;
other armed Workers also include their ordinary run time. The exact per-slot
values are in `observer-timing.json`. No FPS or benchmark was collected.

The sole native lifetime ran 11:19:14–11:26:34 UTC, with cleanup complete
11:26:42. A preliminary background shell failed before creating any controller
or browser; the succeeding durable execution session owns the sole native
launch. Deadlines were reset immediately before that launch. Deus explicitly
posted FULLRELEASE at 11:18:40, and actual global process/profile gates passed
before launch. Wrapper, controller and monitor all held the browser-lock FD
for their lifetimes. Sixteen observed PID/start identities, including both
global crashpads, are absent; HTTP/CDP/control ports `33041/46033/42217` are
closed, the profile is removed, and the full flock is available. No cleanup
signals or foreign signals were needed. There are no owned watchers or held
keys/buttons. All 52 native input events are trusted; the guest input trace
receives both steering directions as VK_LEFT/VK_RIGHT down/up.

Focused validation passes for 296 source/compiler files, 40 support files,
1,374 originals, 2,129 served responses / 104 source URLs, both constructed
factory results and the cache hit, five rejected evidence mutations, native
material/texture draws, input, idempotent observer restoration and complete
cleanup. `git diff --check` passes. Minimum sampled free disk is
2,011,791,360 bytes, above 2 GB. Full lane release was posted at 11:27:14;
no further native/heavy CLI work is planned. No Boat allocated: ID/state/expiry
N/A. Remaining limits are the differing initial port and shader/mesh names,
no St. Kitts arrival/combat acceptance, and no same-mesh factory-to-draw claim;
they do not erase the observed fixed-native terrain/coast improvement.

## Onward Montserrat landing; disk floor ends town approach (2026-10-31 11:34 UTC)

Evidence/recovery: `scratch/runs/20261031T1134Z-pirates-onward/RECOVERY.md`.
**A native landing party and movement ashore are inspected; onward town
arrival, Enter/Attack response and combat remain unproven.** The first observed
dependency ending this attempt is the required free-disk floor, not an
identified game/emulator fault. There is no startup-only acceptance.

Before freezing the new run, all 296 current source/compiler files and 40
support files exactly matched the accepted 11:17 closure. The served and
loaded module is again SHA256
`078d81cba6ab755d6a05e5e234a259df9e867ecc8848899705a45739fab0e9a9`.
All 1,374 original files match before/after. This fresh default guestWorker,
WebGL 1024×768 session has cache disabled and tiny disk caches. No factory,
draw, guest-run or thread-init observer is installed. The only input observer
forwards the original renderer input poll unchanged. No production, original
asset, INI, clock, save-byte or guest-memory changes were made.

Ordinary input follows the English captain to Antigua's initial town menu
(`16-antigua-approach.png`), then Sail Away → “No matter, cast off!” and
trusted Numpad4 steering. The visible approach frames `21` and `22` lead to
the actual landing-party prompt at Montserrat's northern shore (`23`).
Selecting “Yes, we'll anchor here” and pressing Enter changes the scene to
the party at Hangman's Point, with “Press 'r' to return to ship” and native
Move Forward/Turn controls (`25-ashore.png`). Personally inspected `26`,
`28`, `30-town-walk.png` and `31-inland-turn.png` show the party moving along
textured coast toward the visible Montserrat buildings. This is a real
ashore transition and subsequent movement; a town label or destination speech
alone is not accepted as arrival. The later town interaction was not reached.

The sole browser lifetime is 11:35:35–11:39:41 UTC. Free disk passed the
prelaunch gate, sampled at 2,051,796,992 bytes at 11:39:04, then fell to
1,908,424,704 bytes at 11:39:41. The bounded controller/monitor closed the
session during the last requested Numpad8 hold. Its requested final screenshot
`32-town-approach.png` was never produced. No second native session was
launched. No original native save/export was reached or claimed.

Cleanup is explicitly qualified: the trusted final input stream includes
Numpad8 keyup at 11:39:41.033, and all 58 trusted key/mouse events balance
to no held input. `held-final.json` retains a stale controller Set entry for
Numpad8 because the interrupted request's timer had not finished; that Set is
not accepted as the input state. Browser exit is 0 at 11:39:41.451, the input
observer was restored, all 16 unique observed PID/start identities including
both global crashpads are absent, the profile and HTTP/CDP/control ports
`35767/38981/45679` are gone, and the full browser flock is released.
The owned monitor sent one PID/start-qualified SIGTERM to its still-live
controller after browser closure; wrapper/controller exit 143 is preserved,
not represented as a clean harness exit. No foreign process was signalled.

Focused closure/native-input/cleanup checks pass for 296 source/compiler
files, 40 support files, 1,374 originals, 2,130 served responses and 31 PNGs.
The checker explicitly retains the negative goal result, disk-floor crossing,
missing final capture and interrupted-controller limitations. Full lane
release was posted at 11:40:16. No Boat: ID/state/expiry N/A. Recovery keeps
the frozen closure and complete ordinary-input route. Next requires restoring
disk headroom before a separately authorized native attempt toward actual
Montserrat town Enter/Attack or a nearby ship encounter.

## Montserrat port and stable tavern; coast Enter/Attack still unproven (2026-10-31 11:49 UTC)

Evidence/recovery: `scratch/runs/20261031T1149Z-pirates-town/RECOVERY.md`.
**Actual Montserrat town interaction and a stable tavern interior are now
inspected. The requested landing-party coast Enter/Attack route and combat
remain unproven.** This attempt takes the ordinary sea entrance to the town;
it must not be described as completing the earlier Hangman's Point walk.

The untouched fresh game selected **Nevis**, rather than Antigua. Crew
Signups, the English captain, Nevis's actual town menu (`23-nevis-port.png`),
Sail Away and Cast Off were followed with trusted input. The native map
(`32-southward-turn.png`, despite its filename) established Montserrat's
location. Keypad steering and the inspected coastal approach led to the
actual French Stronghold of Montserrat town menu (`41-montserrat-response.png`).
Selecting Visit the Tavern and pressing Enter opened the rendered interior
(`44-tavern-response.png`). A second capture `45-tavern-stable.png`, over
11 seconds later, retains the interior, characters, fireplace and invitation
to choose someone to talk to. Escape returns to the town menu (`46`). This
is a new interactive scene, beyond destination speech or a town label.

Subsequent attempts to approach beach after sailing away instead automatically
entered the harbor again (`54`, `62`). No landing-party transition, ashore
walking, coast Enter/Attack prompt, attack selection or combat was observed
in this run. The first route dependency is the changed initial port, followed
by harbor interception of these coastal approaches; no emulator defect is
identified. The prior 11:34 landing-party result remains separate evidence.

The ordinary native Load/Save tab (`69`) → Save Game → first Empty Slot (`70`)
returns to sailing with **Game saved** (`71`). A read-only copy of the native
VFS result is retained as `slot1.pirates_savegame`: 1,028,097 bytes, SHA256
`af989794bb4bce19b583806d42b69ec83d8985e79fe4108ad1a1584b6aca1d60`.
Its actual guest path is `c:\my documents\my games\c:\slot1.pirates_savegame`;
the unusual embedded drive component is preserved. This is an offshore save
after the town visit, not a save inside the tavern or an invented coast
checkpoint. Native restore of the exported file is **untested**. No save bytes,
assets, INI, clock or guest memory were edited.

All 296 current source/compiler files and 40 support files matched the exact
11:17 fixed closure before launch. The frozen, served and loaded module is
SHA256 `078d81cba6ab755d6a05e5e234a259df9e867ecc8848899705a45739fab0e9a9`.
All 1,374 original inputs match before/after. The default guestWorker,
WebGL 1024×768 session has cache disabled, tiny disk caches, bounded console
capture and no factory/draw/init instrumentation. The unchanged input-poll
forwarder was the only runtime observer. Prelaunch free disk was
2,363,781,120 bytes; the minimum controller sample was 2,210,430,976 bytes.
This attempt did not stop on the disk floor. No new build or heavy CLI ran.

**Harness lifecycle limitation:** initial wrapper/controller/monitor identities
prove three distinct holders of the browser-lock FD. However, the launcher
artifact says exit 0 at 11:53:40 while the browser/controller continued serving
actions until 12:06:52. The execution session later returned **143**. Original
wrapper/controller/monitor finalizers and raw browser/controller exit records
are missing; their disappearance's cause is unestablished. Full-lifetime
wrapper/monitor correctness is therefore **not accepted** from this run.
The stale launcher artifact is retained, not represented as a clean exit.

Recovery attached to the existing sole browser, retained all 126 trusted,
balanced input events, restored the original input poll and called Browser.close.
The recovery helper exited 0 and recorded closure at 12:07:26; this is not
the unavailable raw Chrome exit code. All 15 recorded PID/start identities,
including both global crashpads, are absent. HTTP/CDP/control ports
38323/33491/40805 are closed, the profile is removed, held input is empty,
the actual whole-browser gate is clear and the full flock is available.
No cleanup signals, foreign signals or second browser were used. FULLRELEASE
was posted at 12:07:47, with a correction to the initial board summary's
incorrect signal/count wording. No Boat: ID/state/expiry N/A.

Focused `verify.py` passes frozen/served identity (2,225 responses), originals,
trusted balanced input, 72 captures, save hash and recovered cleanup; three
negative controls reject a wrong module, untrusted input and a held key.
It explicitly preserves the negative coast/combat result, untested restore,
missing raw exits and unproven full-lifetime wrapper. The next useful work is
an authorized native restore check and a northern landing route that avoids
the harbor, with a durable wrapper/controller/monitor lifetime.
