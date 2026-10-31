# OpenGL / Direct3D corpus status, reconciled 2026-10-20

## October 31: known-source browser gameplay and remaining rendering blockers

UT2004 documentation `2342e9288` records original DM-Rankin software CLI
play in `20261031T0427Z-ut2004-match`: native movement, look and firing,
health100 and ammo100 to96 then94. The coordinator inspected the readable
firing frame. The runtime completed 8,425 batches in636.949 seconds and
exited zero; 998 original inputs and1,283 retained pins verified unchanged.
The default guestWorker browser follow-up `09eb0ecbe` also verifies original
DM-Rankin movement, look and firing on the actual software endpoint:
health100, ammo100 to99 then98. The coordinator inspected the readable
world/HUD frame. Run `20261031T0451Z-ut2004-browser` verifies 998 original
inputs, 292 source files and 107 served responses. Repair `fb698d57e`
then moves the windowed-device HWND into shared atomic process state so
presentation instances retain the correct client origin24,44. Run
`20261031T0514Z-ut2004-origin` verifies the actual software browser route on
new module `9b4e39a2`, with its exact295 source files and seven compiler
inputs retained. The coordinator inspected the complete top clock and
bottom HUD during native movement/look/fire, health100 and ammo100 to98.
Visible DeathMatch and PLAY clicks work at their displayed coordinates.
The full build and focused real-instance/pixel/Reset/DirectDraw tests pass;
the new regression rejects the saved old source. Enemy hits/kills, match
completion and WebGL remain unverified. See the
[UT2004 native route](re-notes/unreal-family-demos.md#ut2004-original-dm-rankin-movementfire-retest-2026-10-31).

UT2003 diagnosis `b2647538c` in `20261031T0531Z-ut2003-readback`
attests actual WebGL endpoint1 on the same exact `9b4e39a2` build.
DRAW29 rejects a multi-level cube texture with LOD bias-0.5; READBACK48
inherits that queue error, and the first LockRect completes with
INVALIDCALL after token clearance and ESP+20. The coordinator inspected
the original crash dialog and reran the causal check successfully;881
original inputs,295 source,7 compiler and107 served pins verify unchanged.
Repair `5fa12b1be` now implements generic cube LOD sampling with face-local
mip atlas/filtering. All8,880 WebGL1/2 pixel checks and the full locked build
pass; saved old source rejects. Run `20261031T0542Z-ut2003-cube-lod` retains
fresh `9b4e39a2`, exact295 source/seven compiler inputs and881 originals,
107 served pins and88 trusted native events. DRAW29/READBACK48/LockRect
complete successfully. The coordinator inspected native DM-Antalus world/HUD,
health100 and ammo146 after movement/look/fire through the game's console
`open DM-Antalus` route. Actual WebGL2 records21,049 completed draws with no
failures. Runtime cleanup recovered an interrupted finalizer and verifies all
owned processes/ports/profile closed. Menu PLAY, FPS, audio, kills, match
completion and a matching software-arm qualification remain unverified.

Deus Ex documentation `940371775` verifies the default guestWorker browser
Training route on actual SoftDrv: native approach/retreat, first door opened
with right mouse, then crossed into the red-floor room. The coordinator
inspected that gameplay frame. Run `20261031T0447Z-deusex-browser` verifies
131 original/support inputs, 292 source files and 105 served responses.
Key pickup, the next locked door and Training completion remain unverified.
See the [Deus Ex browser notes](re-notes/deus-ex-demo.md).

Pirates documentation `a7725adaf` verifies native sailing near St. Kitts
and Nevis in `20261031T0458Z-pirates-knownsource`; the coordinator inspected
the ship/HUD and persistent white coast. Four matched mesh sequences retain
attached properties into effective renderer state; ordinary map slots are
empty while a separate array is populated. Follow-up `83ae79866` in
`20261031T0520Z-pirates-maps` proves the original separate-map writer and
encoded reader contract. Four matching writer/default-setup mesh sequences
include two actual large-draw correlations; the coordinator inspected the
native coast image. Selection follow-up `de5d26f5f` in `20261031T0535Z-pirates-selection`
proves original terrain name selection and encoded NSB stage references.
The original factory returns null for66 terrain requests; nine same-mesh
correlations explain subsequent default-shader draws. The coordinator
inspected `sailing.png` and reran the causal evidence check successfully.
The rejection inside original factory lookup `5bd720` remains unresolved;
cache/library lookup, requirements and creation must be distinguished.
No crash reproduced or repair landed; 1,374 original inputs, 292 source files and 467 served responses
verified. See the [Pirates boundary notes](re-notes/pirates-2004.md).


Forsaken documentation `50bb30050` records a known-source WebGL frame
investigation in `20261031T0427Z-forsaken-frame`. The coordinator inspected
`thrust-short-gpu.png`: briefing text, loading bar and incomplete world
exist inside the GPU color target, alongside projectiles. Earlier firing
frames show a readable room, but sustained readable world coverage remains
unverified. The first missing/ineffective world draw has not been located;
clear, blend or lighting changes lack a demonstrated cause. No production
repair landed. Original873 files, runtime107 pins and26 trusted native
events verified; three GPU mock tests passed, while an unchanged fallback
counter test failed. This is a rendering blocker, despite zero measured
GPU errors or fallbacks. See the
[Forsaken investigation](re-notes/forsaken-demo.md#known-source-webgl-frame-investigation-2026-10-31).

The earlier gameplay runs pin module `8459597c` to the retained ReVolt locked build's exact
292-file source snapshot, including then-concurrent font edits; observed
HEAD is not substituted for compiled source. The UT2004 repair uses the
separately retained `9b4e39a2` source/compiler snapshot described above.
Own runtimes were cleaned.
These results extend the per-app evidence without establishing software /
WebGL parity, audio, real-time performance or completion of the full27.


## October 31: Re-Volt attachment repair reaches native WebGL driving

Repair `59a615fc5` fixes GetAttachedSurface matching for allocations created
before DirectDraw 7: unused DDSCAPS2 extension words no longer reject an
otherwise valid back buffer. DX7 allocation validation remains active.
Run `20261031T0403Z-revolt-backbuffer` reproduces the original failure on
locked build `44aa9976` and reaches the menu, starting grid and native
Up/Right/Down driving on repaired build `8459597c`. The coordinator inspected
the race frame: the car is off-road and overturned. Movement is verified;
checkpoint, lap and race completion are not.

Both builds retain exact source snapshots, including concurrent dirty font
work; neither is described as a clean commit build. The default guest-worker
route uses explicit WebGL at stable 1024×768, with all 444 original input
files unchanged before and after. Locked builds and the focused native COM
regression pass; the new regression also rejects the saved pre-fix source.
Two older synthetic fixtures fail identically before and after, outside the
repaired lookup. Own browsers, controllers, ports and profiles were cleaned;
the after controller's exit 143 remains unexplained. No software gameplay or
full-corpus parity is established. See [Re-Volt investigation](re-notes/re-volt-demo.md#known-source-attachment-repair-and-native-race-2026-10-31)
and the run's retained recovery recipe for the next controlled-lap attempt.

## October 31: Tunnel, Globe and Wormhole startup crash sweep

Run `20261031T0240Z-dx-more-startups` launched registered `dx_tunnel`,
`dx_globe` and `dx_wormhole` through the cooperative CLI software route,
without injected input. All three exited zero with no `CRASH`, `RuntimeError`,
`unreachable` or unimplemented-API signature in their logs. Tunnel completed
2,905 batches in 15.064 seconds, Globe 16,834 in 15.130 seconds, and Wormhole
reached 100,000 batches in 9.700 seconds. Personally inspected PNGs show
textured tunnel walls, the registered textured Globe scene, and Wormhole's
yellow-green wire grid. Globe's appearance is not a fresh scene-correctness
finding; preserve the original-scene distinction in its investigation note.

The module hash is
`8333a35b1efa694462033e87f62ce4a3f5497941d1423540b39a590c9d31134a`;
compiled-source identity is unknown. Module, region-map, registry and runner
hashes stayed unchanged across execution, as did all 38 registered input
files per app. Exact commands, process exits, hashes and observations are
retained in `executions.json`, `inputs.json`, `after.json`, `assets.json`
and `summary.json`. No source changed or emulator defect was established.
These bounded software startup observations do not establish WebGL parity,
gameplay, audio, performance or completion of the historical 27-app set.
No matching candidate manifest entry was identified, so this remains
investigation evidence without a dashboard `result.json`. All three child
processes ended; no browser, server or Boat was created.

## October 31: bounded Twist and Boids cooperative startup crash sweep

Run `20261031T0237Z-dx-launch-sweep` launched the registered `dx_twist`
and `dx_boids` executables with `test/run.js --no-build --no-threads`,
without injected input. Twist completed 6,641 batches in 15 seconds;
Boids reached the 100,000-batch limit in 5.892 seconds. Both runners exited
zero, with no `CRASH`, `RuntimeError`, `unreachable` or unimplemented-API
signature in the preserved logs. Personally inspected final PNGs show the
textured Twist object and colored Boids flock triangles with cyan boundaries.

The loaded local module hash is `8333a35b1efa694462033e87f62ce4a3f5497941d1423540b39a590c9d31134a`.
Module, region-map mirror, runner and registry bytes stayed unchanged across
both executions; their hashes and exact commands are retained in `inputs.json`,
`executions.json` and `summary.json`. Compiled-source identity is unknown;
the launch-time HEAD is not proof of that identity. These are cooperative
CLI software startup observations, not new WebGL, threaded, scene-parity,
gameplay, audio or performance acceptance. No matching candidate manifest ID
was found, so the bundle remains investigation evidence without a dashboard
`result.json`. Both child processes ended; no browser, server or Boat was
created. No source changed or emulator defect was established.


## October 31: bounded OrganicArt original-input recovery found missing source

Run `20261031T0058Z-organicart-recovery` searched the accessible retained
local sources without repeating the native logo-toggle or substitute-image
controls. No authentic `CALogo.gif` or source-verified Plus! 98 installation
registry defaults were recovered. Consequently no new scene replay or
production change is claimed.

The search inspected 538 ZIP indexes and 104 TAR/TGZ member lists, plus one
ISO listing. Its only OrganicArt executable match was a byte-identical copy
of the existing `OASAVER.SCR` in `/tmp/caesar3-packet.tgz`; it supplies neither
the missing logo nor installation settings. All 47 CAB listing attempts
failed on unrelated retained game installers' InstallShield format; their
contents remain unverified. A UTF-8/UTF-16 settings search over 380 retained
INF/REG/INI/THE/SCN files found no logo/default-setting evidence. The original
executable's 57-resource inventory has no named CALogo resource and the PE
has no GIF87a/GIF89a signature; encoded/compressed assets are not ruled out.

The concrete missing input is the authorized original Plus! 98 installation
media/metadata or a verified installed logo/settings export for this package.
The historical source lead in `directanimation-design.md:146` is
`/Volumes/PLUS98/PLUS98.CAB` and memory `reference_plus98_iso.md`; neither is
present here. This lead does not establish that the CAB contains the logo.
Native fallback values do not establish installation defaults, so an arbitrary
logo-disable setting remains unjustified.

The run preserves the search recipe, archive results and limitations,
192-file screensaver SHA-256 manifest, original archive/member hashes and
`verification.json`: all 85 prior registered inputs and 192 retained files
remain unchanged. Original `OASAVER.SCR` SHA-256 is
`470e28bcbc3cf92c514cd8e8bbf9eae399c59f79ed2adbf7bf2b91d25cfb477c`.
No browser, server, profile or Boat/test box was created; no runtime cleanup
is outstanding (box ID/state/expiry not applicable). This was a local source
recovery attempt within the 25-minute bound, not a fresh rendering test.

## October 31: OrganicArt rectangle isolated to native logo input

Run `20261031T0046Z-organicart-logo` supersedes the startup-only native
registry comparison in `20261031T0034Z-organicart-rectangle/logo-ab`.
Both new WebGL arms reached original scenes by 45 seconds and ran for
210 seconds. With native `DisableCALogo` DWORD **0**, personally inspected
45/150-second scenes contain the lower-right white rectangle; with DWORD
**1**, inspected 45/150/210-second scenes do not. Read-only guest observations
confirm the native disable flag is respectively 0/1. The enabled 210-second
scene also lacks the rectangle, consistent with the app's hide-logo path;
this is not a permanent obstruction.

The white area is present in both the 640×480 backing canvas and DirectDraw
frame layer. In the saved enabled layer, all 3,060 pixels of
`[550,434,640,468)` are white; the corresponding disabled sample has zero
white pixels. A separate native trace records `DisableCALogo -> 0`, no
`CALogo` override, and `SearchPath("CALogo.gif", path=".") -> NOT FOUND`.
No such file is among the 84 registered scene assets or available screensaver
files. A fourth launch keeps the logo enabled and sets the app's native
`CALogo` REG_SZ to the unchanged, already-registered `BOLD6.GIF`: lookup and
file reads succeed, and personally inspected scene/layer captures show an
orange/brown texture in the former white rectangle. This deliberate image
substitution diagnoses the missing default logo input; it does not restore
the authentic Computer Artworks logo.

No production code or default registry setting was changed, and no guest
memory was patched. A renderer repair is not established. The remaining
repair dependency is authentic Plus! 98 logo assets and/or installation
registry defaults, followed by an original-input replay. The native disable
key is a demonstrated workaround, not an accepted production repair.
Randomized scenes differ between arms; this is not same-frame parity, and
software was not rerun in this follow-up.

All four launches use original `OASAVER.SCR /s`, the same 85 executable/scene
input hashes, retained module SHA-256
`d83e413fbc38ca5aa5447a7be62d10010783fd5490c98ec07c076553897950e5`
(source fix `de2e338c4`, full source unknown), Chrome 151/ANGLE SwiftShader,
and guest threads disabled. Exact capture hashes, native traces, byte checks,
reproduction instructions and cleanup are retained in the run's
`investigation.json`, `verification.json` and `recovery.txt`. Concurrent SDK
Viewer changes to `lib/apps.js` and generated file-size metadata were handled
by recovering byte-identical served versions from launch commit `49340601e`;
all 920 served-response hashes verify against current or retained exact bytes.
The first controller was later reaped with status 143 after its cleanup
record; the signal's sender is unknown. Both later controllers exit 0. All
three browsers are absent, six HTTP/CDP ports closed and profiles removed.
Browser work ran approximately 00:45:50–00:56:32 UTC, within 25 minutes.
No Boat/test box was used (ID/state/expiry not applicable).

## October 31: OrganicArt rectangle reproduced on both routes

Run `20261031T0034Z-organicart-rectangle` reproduces the lower-right white
rectangle over original OrganicArt scenes on software and WebGL. Personally
inspected WebGL frames 2/3 and software `restored.png` show different scenes,
so this is not a same-frame parity check. WebGL records one visible 640×480
Screen Saver window and host GPU enabled. Software point inspection places
the rectangle inside the displayed canvas, rather than a separate HTML
overlay. Its owning drawing operation and cause remain unresolved; no emulator
repair is claimed.

All three launches used retained module SHA-256
`d83e413fbc38ca5aa5447a7be62d10010783fd5490c98ec07c076553897950e5`
(source fix `de2e338c4`, full source unknown), Chrome 151 with ANGLE SwiftShader,
registered `/s` startup and guest threads disabled. Each launch verified 85
executable/scene input pins and 230 served-response hashes. The short software
arm captured startup only. A secondary CDP connection temporarily resized
the longer software arm; its inspected capture followed viewport restoration.
Layer extraction failed when that target closed, so no backing-layer evidence
or cause is inferred. All browsers and servers closed and profiles were removed;
no Boat was used. `investigation.json` records these limits and exact captures.

## October 30: PTCT paired original browser rendering

Run `20261030T2351Z-ptct-paired-browser` captures the original registered
Please the Cookie Thing intro on software and WebGL. Two personally inspected
frames per route show gray/white geometric beams changing shape and position
on black. The software route reports `gl_sw_enabled() == 1` without a GPU
presentation layer; WebGL has an owning GPU layer whose sequence advances
from 132 to 169. Normal startup uses the registered dialog command, without
a guest patch. Guest threads were disabled.

Both routes loaded canonical module SHA-256
`d83e413fbc38ca5aa5447a7be62d10010783fd5490c98ec07c076553897950e5`
(source fix `de2e338c4`). Each registration's executable and all 144 served
response hashes were verified. Chrome 151 was launched with ANGLE SwiftShader
flags; the GPU vendor string was not queried. Both browsers and static servers
closed, private profiles were removed, and no Boat was used. Exact timestamps,
input pins, capture hashes and cleanup checks are in `investigation.json` and
the two route `verification.json` files. This establishes visible animation,
not full intro correctness, same-frame parity, FPS, physical GPU performance
or original 27-app membership.

## October 30: six screensavers, consolidated paired browser captures

Run `20261030T2340Z-screensaver-browser-batch` completes inspected scene
captures for the six siblings of Architecture on both browser routes:

| App | Personally inspected result |
| --- | --- |
| Falling Leaves | Leaves and shadows change over the textured leaf background on both routes. |
| Geometry | Gold polyhedra change arrangement over the blue radial background on both routes. |
| Jazz | White musical-note clusters change on black on both routes. |
| OrganicArt | Software changes from a patterned tunnel to rings; WebGL rings change orientation. A white lower-right rectangle remains unexplained. |
| Rock & Roll | Guitars and picks change orientation on both routes. |
| Sci-Fi | Birdlike objects render over the textured alien landscape on both routes; motion was inspected only on software. |

These are original registered executables and scene assets, launched normally
with `/s`, guest threads off, Chrome 151 and ANGLE SwiftShader. Every launch
served retained canonical module SHA-256
`d83e413fbc38ca5aa5447a7be62d10010783fd5490c98ec07c076553897950e5`
(source fix `de2e338c4`). Per-frame owning-host GPU state matches the selected
route. The six registrations contain 114 executable/scene input entries,
all hash-pinned. Of 2,270 served responses across the batch and retries, 2,263
were reverified against current bytes or retained matching HEAD bytes. Seven
intermediate `lib/host-audio.js` responses cannot be reverified after concurrent
worker edits; their exact recorded hashes remain in the route verification
records. This is an explicit provenance limitation, not a full immutable
source replay.

Initial WebGL Jazz captures caught startup; a longer fresh run produced the
inspected notes. The software browser target closed after OrganicArt, with no
established cause; a fresh bounded run captured only Rock & Roll and Sci-Fi.
All four browsers are absent, static ports closed and private profiles removed;
no Boat was used. `investigation.json` records exact inspected images,
verification counts and limitations. This establishes visible scenes, with
motion where stated, not same-frame parity, FPS, physical GPU performance,
complete scene correctness, complete saver cycles or the full 27-app goal.

## October 30: Architecture browser scene on both routes

Runs `20261030T2338Z-architecture-webgl` and
`20261030T2338Z-architecture-software` launch registered original
`ARCHITEC.SCR /s`, with its seven registered scene assets, through the normal
browser launcher. Personally inspected WebGL frames 2/3 and software frames
1/2 show the textured marble interior and changing central green objects.
WebGL frame 1 records startup's white area; it is superseded by the later
rendered captures, not counted as a scene failure.

Both Chrome 151/ANGLE SwiftShader runs load retained canonical module
`d83e413fbc38ca5aa5447a7be62d10010783fd5490c98ec07c076553897950e5`
(source fix `de2e338c4`), with guest threads off. Backend records verify the
owning host's GPU enabled only for WebGL. All eight registered input hashes
and every served-response hash are verified separately in each run. Exact
identities, inspected frames and cleanup appear in `investigation.json`.
Both browsers are absent, their six ports closed and private profiles removed;
no Boat was used. This establishes a visible animated scene on both routes,
not same-frame pixel parity, FPS, physical GPU behavior, a full screensaver
cycle or completion of the historical 27-app set.

## October 30: longer Boids captures establish flock rendering

Run `20261030T2348Z-boids-scene-diagnosis` extends the short paired
captures below. Two personally inspected frames per route now show colored
flock triangles and cyan boundaries changing on both software and WebGL.
The short captures did not establish a missing-geometry defect; no emulator
change was made. Both launches served the retained canonical module
`d83e413fbc38ca5aa5447a7be62d10010783fd5490c98ec07c076553897950e5`
from source fix `de2e338c4`. All 38 registered inputs and 179 served response
hashes per route verified against local bytes. Host `d3dimGpu` was present
only on WebGL. Chrome 151 used ANGLE SwiftShader; page Worker threading was
requested off. The per-app `wine.threads` default remained true and does not
prove Worker execution; no thread-mode comparison was performed.

The browsers and static servers are closed and profiles removed; no Boat was
used. This proves observed flock animation, not same-frame parity, physical
GPU behavior, FPS, full scene correctness, or recovery of the historical
27-member list. Shared SDK Viewer aliases retain their documented provenance.

## October 30: paired Boids motion, incomplete scene acceptance

Runs `20261030T2335Z-dx-boids-webgl` and
`20261030T2335Z-dx-boids-software` retain the original `boids.exe` and each
contain two personally inspected browser frames. Cyan polygon outlines change
position on both routes. The images do **not** establish a correctly rendered
flock; this is narrower than the earlier colored-triangle observation.
Both Chrome 151/ANGLE SwiftShader runs loaded canonical module `d83e413f…`
(source `de2e338c4`) with guest threads disabled. Owning-host GPU state was
verified enabled for WebGL and disabled for software. Each run verifies all
38 local SDK-directory input hashes and all served response hashes; the input
manifest includes the renamed ProgressiveMesh aliases described below.
`investigation.json` records exact module identity, backend and frame paths.
Both browsers were stopped, all six ports closed and private profiles removed.
No Boat was used. Full scene correctness, pixel parity, FPS and historical
corpus membership remain unqualified.

## October 30: Globe motion verified on both repaired-build routes

Runs `20261030T2330Z-dx-globe-webgl` and
`20261030T2330Z-dx-globe-software` each contain two personally inspected
captures of the original SDK Globe executable. The shaded, textured sphere
changes orientation on both routes. This closes the earlier unverified WebGL
motion finding after GPU Execute extent repair `de2e338c4`; it does not resolve
the historical texture-band correctness question or establish pixel parity.

Both Chrome 151/ANGLE SwiftShader runs loaded retained canonical module
`d83e413fbc38ca5aa5447a7be62d10010783fd5490c98ec07c076553897950e5`.
WebGL had the owning host's `d3dimGpu` and GPU selection enabled; software
had neither. Guest threads were disabled in both. Each run verified 38 local
SDK-directory input hashes and all 182 served-response hashes. Its `investigation.json` records
frames, build/backend evidence and cleanup: browser absent, three ports closed,
private profile removed, no Boat. The different orientations and sphere sizes
are not a same-frame comparison; FPS, full scene correctness and completion of
the historical 27-app corpus remain unqualified.

## October 30: original Tunnel WebGL motion verified after extents fix

Run `20261030T2325Z-dx-tunnel-gpu-extents` retested original `dx_tunnel`
with the canonical module retained from the passing build for GPU Execute
extent repair `de2e338c4`. Two personally inspected browser captures show
changed tunnel orientation and texture position. A bounded trace of 284
copy/present events contains 94 distinct scene-region hashes on both primary
surface and render target, excluding the text overlay.

Chrome 151/ANGLE SwiftShader loaded module
`d83e413fbc38ca5aa5447a7be62d10010783fd5490c98ec07c076553897950e5`.
All served-response hashes match their local inputs. The run's `result.json`
records module identity, captures and verified cleanup: browser exited, three
ports closed, private profile removed, no Boat. This closes the earlier
unverified WebGL motion finding for Tunnel; pixel parity, full scene correctness,
performance and completion of the 27-app corpus remain unqualified.

## October 30: Twist WebGL animation repaired

The original `dx_twist` browser run `20261030T2320Z-dx-twist-gpu-extents`
now visibly deforms and rotates its textured sphere. Three captured frames
were personally inspected. The bounded copy trace contains 101 distinct
scene-region hashes on both the primary surface and render target; changing
copy rectangles cover the sphere. Before the fix, run
`20261030T2316Z-dx-twist-copy-trace` copied only the FPS text rectangle after
the initial frame, leaving the primary scene unchanged despite target updates.

The GPU executor omitted ExecuteBuffer status extents that D3DRM consumes to
choose its windowed copy rectangle. Accepted draws now report conservative,
clipped coverage while Execute still owns that status, independently of later
batch submission or readback. Wrong-target, inactive and empty reports are
ignored. Triangles, lines, points, clipping and deferred submission have focused
coverage, including the actual compiled WASM export.

The locked canonical build and five focused D3DIM tests pass. The original
Chrome 151/ANGLE SwiftShader run loaded retained module
`d83e413fbc38ca5aa5447a7be62d10010783fd5490c98ec07c076553897950e5`;
served-response integrity and browser/port/profile cleanup are recorded in
its `result.json`. No Boat was used. This establishes visible animation for
this sample; pixel parity, complete scene correctness, performance and the
historical 27-app corpus goal remain unqualified. Earlier stationary-frame
findings below describe the previous build.

## October 30: Twist motion boundary narrowed; no repair yet

Two original WebGL diagnostic runs, `20261030T2305Z-dx-twist-motion-probe`
and `20261030T2307Z-dx-twist-frame-boundary`, used the same verified canonical
module `7e8d3194…` from source `8cfa97b0d`. Runtime-only wrappers sampled
120 distinct submitted vertex hashes and 120 distinct full readback/DIB hashes.
That establishes progressing geometry submission and readback, not visible
animation: whole-frame hashes can change with the guest FPS overlay.

Four later samples excluded the overlay and measured the same scene-region
hash, `3605449039`, while draw count advanced from 14,092 to 14,125. Three
closely spaced screenshots were personally inspected and show the same sphere
orientation. This narrows the unresolved animation gap without identifying its
cause or establishing scene correctness. No production source was changed.
Each run retains its diagnostic logs and `investigation.json`; both browsers
exited, all six ports closed, private profiles were removed, and no Boat was used.

## October 30: paired original Twist renders; motion differs

Runs `20261030T2304Z-dx-twist-browser` and
`20261030T2304Z-dx-twist-software` contain inspected original `dx_twist`
initial/final frames. Both render a dark textured object with a yellow/black
radiation symbol. Software shape and orientation change; WebGL frames appear
stationary. WebGL animation is unverified, and the cause remains undiagnosed.
This is a concrete follow-up gap rather than a scene-correctness pass.

Both loaded module `7e8d3194…` from the passing canonical build of
`8cfa97b0d`, with unchanged source hashes recorded in the copied build
manifest. Chrome 151/ANGLE SwiftShader observed guest threads enabled;
WebGL used `D3DIMGpu`, while software selected DX2–7 WAT without it.
Each run verified 39 input hashes and 38 served SDK responses. Its
`investigation.json` references captures, route/build evidence and cleanup.
Both own browsers exited, six ports closed and private profiles were removed;
no Boat was used. FPS overlays are not benchmarks. Pixel parity, complete scene
correctness and the historical 27-app goal remain unqualified.


## October 30: Tunnel renders from a verified canonical build

Runs `20261030T2317Z-dx-tunnel-browser` and
`20261030T2317Z-dx-tunnel-software` contain inspected initial/final captures
of original `dx_tunnel`: gray textured tunnel walls with yellow/black edges.
Software frames show changed orientation; WebGL animation is not established.
Chrome 151/ANGLE SwiftShader used `D3DIMGpu` on WebGL and the DX2–7 WAT
software rasterizer without `D3DIMGpu` on software. Guest threads were enabled.

The locked canonical build passed on source `8cfa97b0d`; all 1,148 tracked
build-source file hashes stayed unchanged across compilation, with no tracked
source patch. It produced module `7e8d3194…`, matching each loaded module.
This newly verified build reproduces the earlier retained module hash; it does
not retroactively establish the earlier runs' complete host/source identity.
Each run verified 39 inputs and 38 served SDK responses. Build logs, source
manifest, captures, route observations and cleanup are in its `investigation.json`.
Both browsers exited, six ports closed, and private profiles were removed.
No Boat was used. The guest FPS overlay is not a benchmark; these captures do
not establish pixel parity, full scene correctness, or completion of the 27-app corpus.


## October 30: paired original Flip3DTL browser animation

Runs `20261030T2311Z-dx-flip3dtl-browser` and
`20261030T2311Z-dx-flip3dtl-software` each contain inspected initial/final
captures of original `dx_flip3dtl`: a Windows 95 textured cube changes
orientation on both routes. The window identifies itself as Flip3D DISPLAY
HAL. The guest FPS overlay is not an independently measured benchmark.

Chrome 151/ANGLE SwiftShader used WebGL with `D3DIMGpu` in the first run;
the second selected the DX2–7 WAT software rasterizer and had no `D3DIMGpu`.
Guest threads were observed enabled in both. Both loaded retained module
`7e8d3194…`, compiled source revision unknown, and verified all 39 input
hashes and 38 served SDK response hashes. Each run's `investigation.json`
records evidence and cleanup: browser gone, three ports closed, private
profile removed, no Boat. These observations establish animated textured
output on both routes, not pixel parity, full scene correctness, performance,
or completion of the historical 27-app corpus.


## October 30: Viewer original-mesh startup failure

`20261030T2308Z-dx-viewer-browser/investigation.json` records a fresh
original `viewer.exe` browser attempt with WebGL selected. The normal registry
replaces `camera.x`, `mslogo.x`, and `sphere2.x` with tetra/cube test fixtures.
For this run only, the launch manifest instead used the original SDK files
from `dx_globe`, retaining the original Viewer executable. No fixture mesh was
fetched; 39 input hashes and 38 served SDK responses passed verification.

The inspected startup dialog says **Failed to load camera.x —
D3DRMERR_NOTFOUND**. A trusted click on OK left no Viewer windows or running
app. This does not establish a rendered original scene; prior fixture-based
Open/menu checks do not close this gap. Original `camera.x` uses binary
`xof 0303bin` ProgressiveMesh/InlineData representation; the failure's cause
remains unknown. Chrome 151/ANGLE SwiftShader loaded retained module
`7e8d3194…`, compiled source revision unknown. The browser, three listening
ports, and private profile were cleaned up; no Boat was used.

## October 30: paired original Globe browser renders

Runs `20261030T2302Z-dx-globe-browser` and
`20261030T2305Z-dx-globe-software` add inspected initial/final captures of
original `dx_globe`. Both show the titled Direct3DRM sample with a dark shaded
sphere and yellow/black textured band. Software captures show a change in
orientation; WebGL animation is not established. Their different apparent
sizes and orientations are not a pixel-parity comparison or correctness verdict.

Chrome 151 used ANGLE SwiftShader with guest threads observed enabled.
The WebGL UI/console and `D3DIMGpu` identify that route; the software UI/console
identify the DX2–7 WAT rasterizer, with no `D3DIMGpu`. The queried host
`backend` property was unavailable, and OpenGL `gl_sw_enabled()` does not
identify the D3DIM route. Both loaded retained module `7e8d3194…` (full hash
in each `loaded-module.json`), compiled source revision unknown. Each run
verified 39 input hashes and 38 fetched SDK responses. Browser processes and
servers are gone and temporary profiles removed. Evidence and limits are in
each run's `investigation.json`; no FPS, full scene correctness, current-main
build, or complete historical 27-app claim follows from these captures.

## October 30 Boids browser animation

The original `dx_boids` sample rendered moving colored flock triangles and
cyan boundaries in two inspected browser captures. Run
`scratch/runs/20261030T2255Z-dx-boids-browser/` pins the loaded module
`7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`
(compiled source revision unknown), 39 inputs, served asset hashes, WebGL
host selection and a `D3DIMGpu` instance. Chrome used ANGLE SwiftShader and
guest threads. Readback-shadow performance warnings remain; this is animated
render evidence, not complete correctness, pixel parity, FPS, or
recovery of the original 27-member list. Browser and servers were closed.

The paired `20261030T2258Z-dx-boids-software/` run now adds two inspected
software captures with moving colored triangles and cyan boundaries. It uses
the identical retained module and SDK inputs; all 39 input and 38 served SDK
response hashes pass. Host backend `software`, no `D3DIMGpu`, and the UI's
DX2–7 WAT rasterizer message identify the route. Both routes produce animated
output; different animation times preclude pixel parity claims. No FPS or
complete-scene correctness measurement. Its browser, servers and profile were
cleaned up.

## October 30 Pawn browser move

Run `20261030T2250Z-pawn-browser-move` adds inspected original Pawn browser
gameplay: native e2–e4 and engine e7–e5 reply in the composited window, WebGL
selected in Chrome/ANGLE SwiftShader, child GPU frame sequence 2→25. Six
original inputs and fetched Pawn payloads were hash-checked; loaded module
`7e8d3194…`, compiled source unknown. Threads were actually enabled. Exact
backend implementation/export state was not captured; no hardware-GPU or
complete chess-game claim. This does not establish all 27 historical members.

## October 30 Tile World census lead replay

Run `20261030T2242Z-tworld-input` replayed the registered original Tile World
on SDL's GDI route. Root inspected Level 1 before/after ordinary keyboard
movement: remaining chips 6 → 3 and time 200 → 138. Exit 0 after 650
100,000-block batches. Exact module `7e8d3194` and original input hashes are
retained; compiled source revision is unknown. This validates bounded gameplay
for an explicitly named historical census row, while providing no GL/D3D
renderer qualification. Full-level completion and browser replay remain open.

## October 30 Pawn move and extended Jazz scene

Run `20261030T2238Z-pawn-software-move` exercised the original Pawn executable
on software D3D9: e2–e4 input followed by the engine's e7–e5 reply. Root
inspected the composited desktop, including both moved pawns and yellow engine
move outlines. Exit 0, 20,000 batches; all six original input files hashed.
Module `7e8d3194` is pinned; its compiled source revision is not independently
established. This adds bounded CLI software gameplay, not browser parity.

The later `20261030T2236Z-jazz-scene` run resolves the sparse Jazz observation
below: after 180,000 batches the inspected primary surface shows five large
lit musical notes and many smaller notes radiating against black. Exit 0;
seven original inputs verified, retained module `1dbddeaf` / source `d4fb06b46`.
Neither observation reconstructs the missing historical 27-ID membership list.

## October 30 four further original screensaver observations

Run `20261030T2226Z-d3drm-four-scenes` retains five bounded software D3DIM
executions of Architecture, Jazz, OrganicArt and RockRoll. All exited 0;
117 original input identities were hash-checked. Root inspected Architecture's
textured marble interior, RockRoll's intermediate guitars/picks scene, and
OrganicArt's extended-run green/red looping forms against orange. The initial
OrganicArt run ended with an offscreen texture selected; the extended run's
final capture selected the primary surface. Jazz showed small white fragments
against black, so its full scene remains unqualified. Loading frames and
offscreen textures are not evidence of a failed scene renderer. The later
extended Jazz observation above supersedes this run's sparse-scene limitation.

The exact retained module/source is `1dbddeaf` / `d4fb06b46`, as below, preceding
the later GLTron repairs. Commands, durations, surface diagnostics, captures,
input hashes and inspection notes are in the run. These are bounded scene
observations, not visual correctness, browser parity, current-main validation,
performance measurements or completion of the historical 27-app goal.

## October 30 Falling Leaves and SciFi software observations

Run `20261030T2222Z-d3drm-scenes` retains original `scr_fallingl` and
`scr_scifi` software D3DIM executions, each reaching 120,000 batches and exiting
0. Root inspected the final images: gold/green leaf forms over a leaf backdrop,
and flying gold forms above terrain under a red sky. Commands, logs and asset
hashes are retained. These scene observations use the same retained `1dbddeaf`
module/source `d4fb06b46` as Geometry below, before the subsequent GLTron repair.
They establish rendered scenes in bounded runs, not visual correctness,
browser parity, current-main validation, FPS or completion of all 27 apps.

## October 30 Geometry software scene observation

Run `20261030T2217Z-geometry-render` retains two original `scr_geometry /s`
CLI executions on software D3DIM with the real guest `d3drm.dll`, one per
cooperative/threaded scheduler. Both exited 0 after 20 seconds without a reported
guest crash. Root inspected the cooperative intermediate/final and threaded
final images: gold 3D geometry renders against a blue background. Logs, images
and five original asset hashes are retained in the run directory.

The tested module is `1dbddeafbeff685596095d18a4fd9240820b00b0fa293d21ac03393f9f652fb1`,
retained from the original GLTron run on source `d4fb06b46`; this does **not**
validate subsequent main edits. Browser WebGL, backend parity, FPS and other
scenes remain unverified. Loader warnings for absent shell32/ole32 DLL files
remain in the logs. This observation advances one known member's software
evidence; it does not resolve historical membership or qualify all 27 apps.

## October 20 historical membership and receipt matrix

This is the evidence-table deliverable for **GLD3D-CORPUS-27-20261006**, on
documentation base `4d57bb66dae7da0a488b9546ccb0b4f4f7ba2434`. It extends this
canonical document; the dated broader tables below remain historical records.
**The original 27-ID list is not recovered, and the goal is not complete.**
No runtime, census execution, asset download or new build was performed.

### Membership provenance and its limits

The retained memory
`/home/user/.claude/projects/-home-user-wine-assembly/memory/project_gl_d3d_corpus_goal.md`
(modified September 26, originating session
`bd610256-7b4f-4ed1-afa0-9c3cf3412fbb`) records the September 22 count:
27 apps, with overlapping family totals GL7 / D3DRM10 / D3DIM9 / D3D8 7 /
D3D9 2. Original census commit
`2d722ab3766c288d13796ed9dad3f1ceeca8f1eb` independently records 27 among
225 registry entries. Neither contains the complete output.
The memory's SHA-256 is
`edf52a63ba936a24d25b1cd3e21cd4a939e4fb6c92d45fa7a66d93e65fc4d8e4`.
The original registry blob is `65f56177c3bbafe8f4ce0818e5369e44f235777c`;
the original census-tool blob is `45425e4ab7eed19a9aef67bc76365f4baa0885b5`.
These pin the recovery inputs that survive, not the missing binary inventory.

Membership labels in the table below are deliberately distinct:

- **S**: seven explicitly included screensavers. The original commit and
  memory say seven `scr_*`; the [screensaver note](re-notes/plus98-dx-screensavers.md)
  explicitly identifies all seven as members of that 27-app target.
- **N**: `icewind_dale_demo` and `tworld`, explicitly described as two
  census rows in the original commit, despite likely launcher noise.
- **E**: Quake II, Half-Life and Warcraft III are original-commit examples
  of multiple renderers. They are strong leads, but an example is not recovered
  emitted census output.
- **M**: named in the evolving September goal memory's progress notes.
  Their relevance is established; membership in the September 22 output is
  not. Later additions/fixes cannot silently establish original membership.

Thus **nine IDs are explicitly tied to the historical count**, with **18
membership slots unresolved**. E/M rows below are useful evidence mappings,
not assignments to those slots. There are 30 distinct IDs below because the
evolving memory names more than the original denominator; this is not a
reconstructed 30-app or 27-app manifest. `generally`, mentioned in the memory
only to exclude its DirectDraw route, is not added.

The bounded local-history search checked 145 retained project JSONL/gzip
files for the originating UUID and the original 27/87-of-225 census text,
then specifically checked the four retained September histories for census
references. It found memory copies/references, not the original stdout.
The originating session file is absent from that project directory.
The exact search summaries, memory hash and path checks are retained under
`scratch/runs/20261020-gld3d-evidence-matrix/`. This is a local search result,
not a claim that the original session no longer exists elsewhere.

Missing provenance is specifically the September 22 census's enumerated
stdout, or that originating session's tool result. A reconstruction instead
needs the original registry/tool revision **and the contemporaneous
executable/DLL inventory with identities and path resolution**, including
which inputs were missing. Current `gfx-app-census.js` also scans mounted
companion PEs and IID bytes; the original tool did not cover that same set.
`gl-name-census.js` names static reach, not calls, and API-loader/driver
binaries can name all GL entry points. Neither tool can turn current assets,
API conformance tests or family counts into historical membership/gameplay.

### Reading the receipt columns

**H** means a retained committed report says the scene/input was reviewed;
the original run bundle is absent locally in this audit, so there is no new
image/backend revalidation. **L** means the stated local receipt was read;
only Quake II's October 1 before/after PNGs were newly viewed here. **U** means
the required evidence is unknown or not identified. A report's source is
the tested source, not this document's base or a later fix commit.

All run IDs below resolve relative to `scratch/runs/`. Exact IDs are printed
in full; where only a date or glob survives, that is an explicit missing-ID
dependency. The audit's `validation.json` records existence and hashes of
available references without changing evidence. **No row is a current-main
both-backend pass.** Software means the emulator backend, not a game's
internal software renderer. A Node `--headless-gl` result remains a Node
bridge result, not proof of browser WebGL. FPS is unqualified unless a
specific metric and limitation are stated.
Of the 25 exact distinct run directories cited here, only the October 1
Quake II software directory is locally present; the other 24 are absent.
All 11 linked reports exist in the pinned Git base. The shared checkout's
Unreal-family and Black & White 2 notes are older than that base; their
later findings in this matrix were read from the base's Git objects.

Receipt groups used in the table:

- **S6** — [screensaver report](re-notes/plus98-dx-screensavers.md), source
  `80dfe68e`, CLI software D3DIM, `--tick-ms-per-batch=2`.
  Six exact per-app IDs below are given by its pattern; their bundles are
  absent. Jazz's original software ID is only a glob.
- **B6** — the October 6 browser sweep described in this document:
  `20261006T1840Z-gld3d-webgl`, source `97aae839`, browser `--gpu`,
  legacy `?d3dim-gpu`. H, module identity not recoverable from the cited
  summary. This does not certify hardware GPU rather than SwiftShader.
- **P10** — `20261010T1850Z-gld3d-current-main-probes`, source `cac339517`,
  module prefix `6a798f18`, boat llvmpipe/Xorg. Explicit software selectors
  versus Node `--headless-gl` (legacy also `--d3dim-gpu`). H, absent bundle.
  Unrouted probes establish only the photographed state; MCM had a routed race.
- **U10** — `20261010T2050Z-ut-family-both-arms`. H, software D3D8/D3D9
  versus Node headless GL. The dated table does not pin this routed run's
  source/module; do not borrow P10's identity for it.
- **Q8** — the [software review](../ops/handoffs/quake2-software-ordinary-20261008.md)
  and [WebGL review](../ops/handoffs/quake2-ordinary-traversal-20261007.md)
  pin source `096889e174488a97529b8e73076d3a1e2feb2345` and module
  `fb1be916c309bf619a9331c8fd46c4319f9051af76b05b236d3c362bb632638f`.
  Ordinary browser `ref_gl` forward/reverse/idle, six reviewed images each;
  software endpoint/owning Worker proof is described explicitly. H.
- **W8** — [software review](../ops/handoffs/warcraft3-software-20261008.md)
  and [WebGL review](../ops/handoffs/warcraft3-campaign-world-20261008.md):
  accepted source `f62ab3c9f1223ab47cf623470f6343d508257878`, module
  `4dc5ac2c477c71c64a42530562e4cf51e145bd966232e15330acfc01753d54de`.
  Browser guest OpenGL, matching host/owning endpoints, Thrall selection and
  opposing movement reviewed. H; integrated findings `0d9515322` are not a
  new tested build.

### Per-app evidence and missing dependencies

| App / membership | Emulator software receipt and tested identity | WebGL receipt and tested identity | Screenshot / input / FPS status and precise remaining dependency |
|---|---|---|---|
| `scr_architec` / S | H S6: `20261006T0250Z-scr_architec-w4-software`, interior renders. | H B6: `20261006T1840Z-gld3d-webgl`, renders. | Reviewed-render reports only; interactive gameplay N/A; FPS U. Recover both bundles and per-capture backend/module identities. Short white loading captures are not failures. |
| `scr_fallingl` / S | H S6: `20261006T0250Z-scr_fallingl-w4-software`, leaves/shadows. | H B6: `20261006T1840Z-gld3d-webgl`, leaves/shadows. | Historical opaque-shadow defect; the October 10 lit-alpha correction in the screensaver note supersedes “black leaves are intended.” Its paired corrected render receipts are not here. Input N/A, FPS U. |
| `scr_geometry` / S | H S6: `20261006T0250Z-scr_geometry-w4-software`, renders. | H B6: `20261006T1840Z-gld3d-webgl`, renders. | Recover scene captures/identities; historical distant-fill/wireframe issues cannot be judged from API tests. Input N/A, FPS U. |
| `scr_jazz` / S | H P10: `20261010T1850Z-gld3d-current-main-probes`, renders. Earlier software ID only `20261006T02*-scr_jazz-gld3d-sw`. | H B6: `20261006T1840Z-gld3d-webgl`; later P10 is Node GL, not another browser pass. | Recover exact early ID or P10 bundle and paired frames; input N/A, FPS U. |
| `scr_oasaver` / S | H S6: `20261006T0250Z-scr_oasaver-w4-software`, renders. | H B6: `20261006T1840Z-gld3d-webgl`, renders with stray-box caveat. | Scene/timer changes require mid-scene series. `20261011T0640Z-scr-default-clock-w4`, source `dcbdf0521`, explains tick dependence; absent here. Correctness still not revalidated; input N/A, FPS U. |
| `scr_rockroll` / S | H S6: `20261006T0250Z-scr_rockroll-w4-software`, renders. | H B6: `20261006T1840Z-gld3d-webgl`, renders. | Recover paired scene/identity evidence; input N/A, FPS U. Exit capture can be a scene transition. |
| `scr_scifi` / S | H S6: `20261006T0250Z-scr_scifi-w4-software`, renders. | H B6: `20261006T1840Z-gld3d-webgl`, renders. | Recover paired captures; tick dependence and later lit-alpha correction as above. Input N/A, FPS U; source fix alone is not a new render pass. |
| `icewind_dale_demo` / N | U for a GL/D3D route. Later sweep reports DirectDraw as registered. | U for GL/D3D; no backend pass inferred from static `opengl32` text. | Original membership explicit, actual 3D use unproved. Exact traced run ID/source missing; preserve launcher-noise classification rather than inventing a rendering failure. |
| `tworld` / N | U for a GL/D3D route; later sweep classifies tile game as non-3D. | U for GL/D3D. | Same membership-versus-use distinction. Recover runtime trace/source if resolving API scope; no 3D gameplay/FPS acceptance. |
| `quake2_demo` / E | H Q8: `20261008T000901Z-quake2-software-ordinary`. Also L `20261001T230900Z-quake2-universal-software`: browser shared-Worker software, source label `d1ea48a9` plus documented snapshot corrections, module `e3924487eea80ca213d1e4f7865b7823d1f41ea3d5fdb484a382ee2b69f912b8`. | H Q8: `20261007T213620Z-quake2-ordinary-traversal`, browser WebGL ordinary traversal. | October 1 result/benchmark and two PNGs locally inspected: textured room/HUD and changed viewpoint, endpoint `gl/software`; keyboard movement is the original report's claim. Q8's stronger ordinary forward/reverse/idle bundles absent. October 1 **0.850 completed publications/s** is one regressed sample, not general gameplay FPS or paired acceptance. Recover historical membership and Q8 bundles. |
| `warcraft3_demo` / E | H W8: `20261008T0400Z-warcraft3-software-runtime`. | H W8: `20261008T0156Z-warcraft3-campaign-world-runtime`. | Reports review selection/opposing movement on both OpenGL arms; FPS/audio/combat U. Recover bundles and original membership. This says nothing about D3D8 gameplay; preserve laptop Warcraft III ownership/pause. |
| `halflife_uplink` / E | H dated table: September 22 corridor/HUD on software GL; exact run ID/source U. | H `20261006T2100Z-hl-uplink-lazy-mci`, browser GL corridor/HUD after fix `5f4bac8c`; exact tested source/module U. | `4-gameplay-webgl-lazy.png` absent with bundle; source fix is not exact run identity. Ordinary input/FPS not separately established by these summaries. Recover both identities and original membership. |
| `simgolf_demo` / M | H dated table: software gameplay; exact October 6 ID/source U. | H `20261006T0503Z-simgolf_demo-webgl-route-w5`, browser GL course/build bar; tested source/module U. | Historical screenshot review, not fresh controls/FPS qualification. Recover software ID, browser bundle/identities and original membership. Cursor edge-scroll can explain a black view. |
| `ptct` / M | L `20261030T2351Z-ptct-paired-browser/software`: changing geometric beams, WAT rasterizer enabled. | L same run root: changing beams on owning GPU layer; same canonical `d83e413f…`, source `de2e338c4`. | Two inspected frames per route; one executable input and 144 served hashes each verified, cleanup verified. Full intro correctness, parity, FPS and historical membership remain U. |
| `mw3` / M | H older cockpit gameplay; exact routed software ID/source U. | H `20261010T2110Z-mw3-webgl-cockpit-w5`, Node `--headless-gl --d3dim-gpu`, cockpit/forward movement, 49,818 draws/zero fallback reported; tested source/module U. | Node result is not browser proof. Recover both routed bundles/identities, screenshot/input receipts and original membership; FPS U. |
| `dx_boids` / M | L `20261030T2348Z-boids-scene-diagnosis/software`: moving colored flock triangles and cyan boundaries, canonical `d83e413f…`. | L same run, root frames: moving colored triangles/boundaries, same module/source `de2e338c4`. | Two inspected frames per route; 38 input and 179 served hashes each verified; backend and cleanup verified. Full scene correctness, FPS, parity and membership U. |
| `dx_tunnel` / M | H September 23 rendering report; exact software ID/source U. | H `20261006T1935Z-gld3d-webgl-recheck`, browser render; exact source/module U. | Same missing source/scene/ID/membership evidence as Boids; FPS U. |
| `dx_twist` / M | H September 23 rendering report; exact software ID/source U. | H `20261006T1935Z-gld3d-webgl-recheck`, browser render; exact source/module U. | Same missing source/scene/ID/membership evidence as Boids; FPS U. |
| `dx_flip3dtl` / M | H P10: `20261010T1850Z-gld3d-current-main-probes`, textured cube. | H `20261006T1935Z-gld3d-webgl-recheck`, browser render; later P10 Node GL reports 33k draws/zero fallback. | Recover paired images and browser source/module; sample interaction/FPS U. Original membership remains unproved. |
| `dx_globe` / M | L `20261030T2330Z-dx-globe-software`: original textured sphere visibly rotates; canonical module `d83e413f…`, source `de2e338c4`. | L `20261030T2330Z-dx-globe-webgl`: original textured sphere visibly rotates on owning D3DIMGpu, same module/source. | Two inspected frames per route, 38 local SDK-directory inputs and 182 served hashes each. Threads disabled, cleanup verified. Texture-band correctness, same-frame parity, FPS and historical membership remain unqualified. |
| `dx_viewer` / M | Historical fixture rendering only; original plain-Mesh assets unavailable. | L `20261030T2308Z-dx-viewer-browser`: rejects renamed PM input with D3DRMERR_NOTFOUND; no original scene. | `20261030T2334Z-viewer-input-diagnosis` proves camera/mslogo/sphere2 aliases equal PM files. Prior original-mesh provenance claim withdrawn. Restore actual plain-Mesh inputs before original-scene retest; fixture/menu checks remain narrower. FPS and membership U. |
| `mcm` / M | H P10: `20261010T1850Z-gld3d-current-main-probes`, routed Stunt Quarry race, 200 s. | H P10 Node GL routed race, 225k draws/zero fallback reported; older September 20 browser report lacks exact ID here. | Recover route/input/frame receipts; don't promote Node GL to browser. FPS and original membership U. |
| `arcanum_demo` / M | H `20261008T1431Z-arcanum-gameplay-qualified`, browser cooperative software D3DIM, crash-site westward movement. | H same run, explicit browser WebGL, westward movement. | [Review](../ops/handoffs/arcanum-gameplay-20261008.md) pins module `d8d4096f957ed51cecab589b5a1ec7bf402336f13959ce0710faf2f7d3c68960`; full tested closure is missing `provenance/pins.json` (branch base `7e4ce05ce` alone is insufficient). WebGL 434/20.127145 s = **21.562919 visible presentations/s**, idle scene, not scanout. Software FPS rejected because observer missed OffscreenCanvas. Recover bundle/membership. |
| `ut2003_demo` / M | Historical Antalus gameplay; matching current software-arm qualification remains open. | Reviewed October31 actual WebGL2 DM-Antalus native console route, movement/look/fire health100ammo150->146. Generic cube LOD repair resolves original DRAW29/READBACK48/LockRect failure. | `5fa12b1be`, run `20261031T0542Z-ut2003-cube-lod`: exact9b4e39a2,881original/295source/7compiler/107served pins;8880 WebGL pixels/fullbuild and old-source rejection PASS. Screenshot personally inspected; runtime recovered/closed. Menu PLAY, FPS/audio/kills/completion and paired software arm remain unqualified. |
| `ut2003_demo_server` / M | H October 6 DM-Antalus sweep claim, but exact reviewed software `result.json` was already missing in the October 10 table. | H B6: `20261006T1840Z-gld3d-webgl`, browser DM-Antalus/HUD. | Recover software ID/result/source and browser bundle. COMCTL seed applies to both registry entries, but the client failure above is not proof of a server run failure. Ordinary control/FPS/membership U. |
| `ut2004_demo` / M | Reviewed October31 default guestWorker browser software DM-Rankin: native movement/look/fire, health100/ammo98, full clock/HUD and visible-coordinate menu clicks after `fb698d57e`. Run `20261031T0514Z-ut2004-origin`, module `9b4e39a2`, exact295 source+7 compiler inputs; focused/full build pass, old-source regression rejects. Earlier CLI `2342e9288` and browser `09eb0ecbe` also reach gameplay. | H U10 Node GL DM-Rankin spawn, forward/turn; browser September25 report lacks exact ID. No fresh WebGL acceptance. | Coordinator inspected repaired native firing frame; original998 inputs and107 served responses verified, runtime cleanup verified. Software menu-origin blocker repaired; browser backend pair, enemy hits/kills, match completion, audio, FPS and historical membership remain unqualified. |
| `morrowind` / M | No reviewed software movement receipt identified; software fix unit tests do not qualify the world. | H `20261005-morrowind-prison-movement`, browser Worker/WebGL forward/reverse/idle; source `94d18605`, module `2e2fd8d1ca62cd87f0bc09312bc4836108df610d00cb7771bb5ae22755eceedc`. | [Metadata review](../ops/handoffs/morrowind-dashboard-evidence-metadata-20261005.md) reports four reviewed gameplay images; bundle absent. Preserve no-heavy-Morrowind restriction. Recover evidence/membership; no software gameplay/FPS claim. |
| `black_white_2_demo` / M | H `20261010T1638Z-bw2-raster-budget-boat-w6`: software island, 3300 s, zero failed commands; exact tested source/module U in table. | No fresh WebGL gameplay receipt identified in this reconciliation. | [Later camera note](re-notes/black-white-2.md) reports `20261011T1840Z-bw2-lock-flag-boat` zoom/drag after the scripted intro; exact backend/source must be recovered before upgrading either column. 3300 s and zero failures are not FPS/control proof. Recover membership and full paired gameplay, preserve pauses. |
| `winamp` / M | No CLI software MilkDrop visualization receipt. | H browser `20261007-winamp-milkdrop-complete-closure`: source `0cbc1c6ffd`, module `7c6864f8e224a0d42c6743b3c088ce79349101182295b79b1e4fa8a4c3911cc0`; ordinary Start ends in illegal-operation `(2)`, not a backend rendering pass. | [Review](../ops/handoffs/winamp-milkdrop-ordinary-20261007.md) reports 11 images and complete-loader rerun. Capture actual exception/API; do not repeat obsolete “needs Winamp 5” inference. Visualization/FPS unqualified; recover bundle/membership. |
| `pawn` / M | H P10: `20261010T1850Z-gld3d-current-main-probes`, D3D9 board renders. | H B6 browser board; P10 Node GL board. | Earlier September 23 gameplay report lacks exact ID/input receipts here. Board image alone does not establish ordinary chess control. Recover bundle, input/identity receipts and membership; FPS U. |

### What this delivers, and what remains unqualified

The nine explicitly linked members now have individual software/WebGL evidence
rows, and all 21 additional named historical leads have separate provenance
labels and dependencies. This closes the documentation omission only to the
proved subset, not the historical denominator or runtime goal. Local historical
imports named `history-scr_*` remain unreviewed/unknown-source evidence and
cannot replace the missing dated run bundles.

The strongest remaining dependencies are (1) original enumeration provenance,
(2) recovery of the dated run bundles and source/backend/PNG/input receipts,
and (3) actual paired gameplay or rendering correctness where only menus,
API tests, Node bridge routes or defective scenes were reported. Missing local
bundles are not evidence of deletion everywhere and do not invalidate the
committed historical reviews. Conversely, a merged caps/mip/Surface/COM fix
cannot turn those reviews into current-main render qualification.

Existing broader-app work, including Darkstone, Hype and Pirates, remains in
the dated sections of this canonical table; none is silently assigned a missing
September membership slot. Preserve laptop Warcraft III/Heroes II ownership,
all game/heavy-run pauses, CMR3's automated-review hold, and other denied-action
restrictions. This document authorizes no rerun, replacement game, Claude
activity, deployment or main integration.

## October 17 retained Darkstone movement review

Later October 15 captures supersede the camera-only result below. Both software
and WebGL show ordinary ground-click movement with a following camera. The
software run exited successfully; the WebGL run retained two movements but
ended at its input-queue deadline (exit 1).

At a closely matching gate/tree/feet pose, WebGL has a substantially larger
black foreground triangle; software still has a smaller wedge. Neither is
established as correct. This is movement evidence with an unresolved rendering
defect, not full backend qualification. Audio, combat, FPS and touch remain
unmeasured. No new runtime was performed on October 17.

See the [reviewed comparison](darkstone-backend-checkpoint-20261015.md#retained-same-pose-comparison-reviewed-october-17)
for exact source/module identities, PNG hashes, draw-completion counters and
cleanup receipts. Runs: `20261015-darkstone-software-movement` and
`20261015-darkstone-locomotion`. Identical-input foreground draw comparison
remains the next diagnostic; the old D3D9 capture format alone cannot preserve
legacy D3DIM live resources and framebuffer/depth history.

## October 15 paired Darkstone result (17:40 UTC)

Fresh source `fadaff08a`, module `9b57583c…`, reached Town through ordinary
character creation on both software and WebGL. Root reviewed before/idle/held
ArrowRight screenshots in both arms: camera control is verified. Main renderer
endpoint 1 reported advancing completed native software draws in the software
arm and advancing WebGL submissions in the WebGL arm. Reported WebGL errors
and all six fallback sites were zero; `declinedClears=1` remains a caveat.
Both arms exited normally and independent postflight verified idle/preserved
inputs. Full archive SHA-256 is
`25252b50372c11589f30439d0a13ab39b09576b5844c1855721c26a429c2aa8f`.
See [the paired receipt](darkstone-backend-checkpoint-20261015.md).
This supersedes backend-unknown for this new run only. Locomotion, combat,
audio, FPS, child renderer ownership and original-27 membership remain open.


## October 15 current integration status (14:38 UTC)

This section supersedes the earlier same-day startup and unmerged-palette
statuses below; those sections remain dated evidence.

- Palette candidate `6b269258560cb24c4370d0cd270d95c2eed7a00b` is now an
  ancestor of main. Its canonical build, sixteen CPU suites, actual WebGL1/2
  observations and both Worker synchronization modes passed. See
  [the exact validation receipt](palette-combined-validation-20261015.txt).
  Default/FALSE filtered-key semantics remain a separate contract question;
  the explicit TRUE-state tests do not settle that question.
- Fixed-function stencil/diffuse handling is merged through `9eb485acb`.
  Actual WebGL1 and WebGL2 each passed 77 observations. Removing the
  missing-texture guard caused six RGB/linkage failures, establishing that
  the oracle detects that regression. See
  [the actual GPU result](iw-render-gpu-result-20261015.json). This validates
  renderer behavior, not Invisible War gameplay or its held transport changes.
- Original .kkrieger reaches a first-person level and one reviewed ordinary
  forward movement. Evidence `2193c3869` and qualification `bee579acb` are on
  main. The [position capture](kkrieger-position-capture-20261015.md) records
  body Z progressing from 0 to 0.686228 at fixed yaw and forward basis, with
  reviewed before/after images. This closes only launch and one movement:
  observed input/release latency, repeated controls, combat, audio, FPS and
  a software/WebGL gameplay pair remain unqualified. The strict per-phase
  comparison still lacks two distinct completed samples; do not call it a
  performance measurement.
- CMR3's software LINELIST implementation is merged in `78a06540f` after
  canonical build, native raster suites and three failing negative controls.
  The [original-game replay](cmr3-lines-gameplay-20261015.md) now passes Stages,
  player/car/transmission/country selection and reaches the UK Warwick stage
  loading map. Rendering then reports `invalid native free list` after batch
  2402. The exact damaged node has not been captured; the first-failure diagnostic passed independent native conformance and is
  merged as `729d3fc73`. The subsequent original replay was automatically
  rejected for possible cybersecurity risk (exact action unspecified), then
  stopped cleanly at 13:08:09. That diagnostic replay is held: do not retry,
  rephrase or delegate it around the rejection. This restriction is separate
  from permitted compatibility/conformance work. Neither driving nor a software/WebGL gameplay pair is qualified.
  [Line conformance evidence](cmr3-software-line-lists-20261015.md) establishes
  the bounded raster fix, not the remaining game's correctness.

The earlier Invisible War transport review below is historical: the corrected
chain was subsequently merged as `3fdb29373`, an ancestor of current main,
after all eight combined native arms completed with their expected results.
The exact negative control failed with `RECEIVER_RETIREMENT_DID_NOT_SETTLE`
and the restored receiver suite passed. See the
[combined native result and merge receipt](iw-combined-native-result-20261015.md).
Original Invisible War gameplay, pointer marshalling and both renderer routes
remain unproved; native conformance does not establish those results.

Before that integration, callback transport remained on task branches. Selective
port `8793e9f47` and endpoint checkpoint `17e713cd2` preserve main's existing
lock, generation pins and INITIALIZING/LIVE/FAILED lifecycle; the older
`e2d10ebb0` branch must not replace those semantics. Exact candidate canonical
module `a948a826…` passed eight native loader/transport suites. Combined
local/Worker and Worker/Worker native endpoint races, nested initialization,
publication acknowledgements and lookup retirement passed at `4050bacb3`.

Independent review then found scheduler teardown could discard a retiring
Worker and reuse its TID/stack before termination. Fix `b5b69a714` passed
actual Worker ABI checks and canonical native validation `dca0e6201`: lost
retirement replies and generation-pin cleanup failures retain ownership;
successful termination releases the real native stack exactly once. The old
code fails the intended ownership assertion; restored code passes. Root
verified archive SHA-256
`22140338c794795536c124019079412943316e4a879b24014b4d51ea763f04fe`
under `scratch/runs/20261015-iw-retirement-native/` and its logs/postflight.

The earlier review blocked integration because PID-wide broker admission
deadlocked independent send chains and blocked a second receiver thread behind
the first.
Root reproduced both failures with real Node Workers, without guest WAT, in
`scratch/runs/20261015-iw-broker-root-review/`. Worker
`/root/iw_independent_send_fix` implemented per-thread, exact-waiting-frame
admission and regressions before the combined validation linked above. Do not
reopen this historical merge blocker as though that correction were absent.

The original 27-app membership evidence and per-game software/WebGL gameplay
coverage remain incomplete. None of these focused tests closes that goal.

## October 15 source-only next-validation reconciliation

Against `73f27af1b`, Age of Wonders II's viewport repairs `9a438f1b9` /
`201de22d9` and Start-click repair `b6e18c196` are ancestors. Its dated row's
terrain/UI defect is superseded by those merged fixes and the October 10
re-note. This audit does not independently re-review the absent October 10
capture bundle or certify a backend pair. Darkstone's complete installed
manifest is locally recoverable, but its original installer and retained
gameplay bundle are absent on this host. Neither absence invalidates the
historical observations below. The two exact next validation routes, fixture
hashes and missing evidence are in
[the bounded handoff](gl-d3d-next-validations-20261015.md).

## October 15 reviewed follow-up (09:36 UTC)

The dated table below preserves earlier results. Signed SHORT2/SHORT4 GPU
inputs and software declaration-component defaults are now on main
`ec4844f16`: canonical build, seven CPU suites and actual WebGL1/2 pixel
comparisons passed. Coordinator independently checked twelve GPU artifacts
and 266 tested-source hashes. Original `.kkrieger` run
`20261015-kkrieger-short-original` eliminates the earlier declaration errors
but still reaches EIP zero near 310 seconds, with 2 GiB memory and no OOM.
Its 42 artifacts were independently hash-checked and final screenshot viewed.
No gameplay is qualified. The next lead is a missing Buffer8 interface;
the game's actual QueryInterface HRESULT remains uncaptured. See
`docs/re-notes/kkrieger-beta.md` for the bounded diagnosis and uncertainty.

The palette candidate remains unmerged. Explicit state144 TRUE zero-RGBA
handling passed canonical build and CPU checks; new Worker coverage passed
both synchronization modes on `d582f0da5`, including native-index duplicate
RGB, held state snapshots, cache transitions and depth. Worker observations
read an XRGB DIB whose unused byte is normalized to 255, not framebuffer
alpha. Source-alpha behavior is checked through blend/test/depth effects;
direct GPU tests separately read framebuffer RGBA. Browser software-path
fixtures exposed incorrect endpoint routing and an assertion on XRGB's unused
byte; their failures are retained, corrected tests are being rerun, and no
full browser acceptance is claimed yet. A cache-identity mutation must still
fail the strengthened oracle. Default/FALSE filtered-key semantics,
alpha-palette/key precedence and legacy stencil remain separate open work.

## Original 27-app membership evidence

The original census commit is
`2d722ab3766c288d13796ed9dad3f1ceeca8f1eb` (22 September). Its message records
27 of 225 apps and seven D3DRM screensavers, but the commit contains only the
census tool and a CLAUDE.md edit, not the complete per-app output. The tool
depends on the executable/DLL files present when run. A current-asset rerun
therefore cannot authenticate the historical membership. The later expanded
69-app census is a different set, not a recovered original list.

The original stdout or session transcript associated with memory session
`bd610256-7b4f-4ed1-afa0-9c3cf3412fbb` is still missing from the inspected local
archives. The 57 references in `scratch/recovery-gl27-20261014/REPORT.txt`
refer to later dated run IDs, not 57 original September runs. Recover the
original output, or explicitly label a historically matched reconstruction;
do not infer a completed 27-app denominator from the current status table.

## October 14–15 targeted follow-up

Authorized Boat exec access now supports separate-box builds and browser tests.
The older blanket remote-access blocker is resolved; missing historical runs
and incomplete per-app software/WebGL qualification remain separate gaps.

| Scope | Verified change and evidence | Remaining work |
|---|---|---|
| .kkrieger D3D9 startup | `c79b943bb` implements signed Q8W8V8U8 storage/upload/sampling; full build and resource, software, WebGL1/2 and pipeline checks pass. `2e1d68489` fixes recycled sparse heap clearing that overwrote live mesh edges; baseline regression fails and fixed regression passes. Original demo advances beyond the persistent mesh loop. Runs `20261014-kkrieger-q8w8v8u8`, `20261014-kkrieger-mesh-writer`, `20261014-kkrieger-heap-fix`. Both fixes are on main. | Census `20261014-kkrieger-memory-census` proves backing shortage: 2,162,688 requested versus438,272 free; tables have capacity. Report on main `6cb760da2`. Registered2GiB route merged9e8afa2e5 uses174,718,976 extension bytes with OOM0 through300s. Follow-up `20261015-kkrieger-registered-600s` then exits around306s after243 generic declaration errors; correlation is not proven causality. Diagnostics/exit guard mergedcb0bf751a; exact original declaration capture is next. Retained heap space is not classified as a leak. No gameplay or both-backend acceptance. |
| Serious Sam cooperative startup | `43f04c7c4` prevents the reproduced low-EIP crash by making synchronous-fault file consumers resident on the cooperative backend. Four browser arms distinguish original failure, eager control, fixed policy and Worker behavior; runs `20261014-sam-browser-*`. Fix is on main. | Karnak gameplay/profile `20261014-sam-low-fps` measures3.18–4.05 actual GLfps on forced SwiftShader; pending GPU completion dominates this box. Report/probe `9b53a3795` on main. Logging-off control and Safari hardware cause remain unmeasured. HUD double-count fix `471dee7c2` passes focused mixed GL/GDI regression, not a performance improvement. |
| Legacy indexed palette candidates | Preserved `c2192e014` passes a separate-box full build and four real-VM CPU/page-watch/resource/software tests. Evidence `20261014-palette-remote-validation`. | Still unmerged. Source reconciliation `f8e4676ce` preserves candidate and main format63 changes. Exact reconciled candidate164dc33ad passed canonical build/four CPU suites; diagnostic-only fixture correction2b28b3e27 passed17 actual framebuffer checks each on WebGL1/2, zero fallback. Root reviewed original runtime hashes and pixel results in `20261015-palette-validation`; forced SwiftShader, reported Intel string is spoofed. Worker reports clean explicit-sync lifetime run125426 with7pixel observations/3blocked-before-drain barriers, pending root receipt review.13of14 follow-up configs pass; Boids route test assumes software default despite current WebGL default and needs explicit route selection. Default-lazy Worker variant, stencil rejection, baseline GPU failure and filtered-key/alpha-key contracts remain gaps. |

These are scoped results, not a new full-corpus sweep. Preserve the historical
rows below as dated evidence; no original 27-app completion is claimed.

The user's goal: every OpenGL and Direct3D app in the registry works on both the
**software** and the **WebGL** backend. This is the one shared status table for
it (task GLD3D-CORPUS-27-20261006). Codex coordinates the remaining work.
The Claude fleet is stopped. Codex coordinates current assignments on the board.
D3DRM rows marked w4 refer to historical work
by claude:65967384 (`docs/re-notes/plus98-dx-screensavers.md`), not a live worker.

Reconciled on **2026-10-07** against main `30f1e268`. This preserves the dated
measurements below; it is not a new full-corpus run. Tomb Raider III and
Half-Life Uplink have later retained browser evidence that supersedes their
earlier failures. Menu, loading, excluded and unmeasured rows still do not
prove the user's full software-and-WebGL gameplay goal.

Selective October 9 reconciliation adds retained Morrowind movement and Pirates
sailing evidence, current Age of Wonders II movement, and the Black & White 2
startup repair. This is not a new full-corpus or both-backend run. Missing
Pirates logs are listed below; the log provenance gaps are not passes.

### October 15 retained evidence update

Darkstone now has a fresh, recovered browser run:
`scratch/runs/20261015-darkstone-town-2`, source controller `c7e23d5f0`,
loaded module `04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17`.
Ordinary character creation reaches Town. The road and gate remain fixed during
five idle seconds, then rotate under held ArrowRight. This proves camera
control; it does not prove champion locomotion, combat, FPS or audio.
The recovered archive SHA-256 is
`60900452d07daac7bfa60ba9e08cf5217ef66bcb1e1bca93388c034477053540`.

The software backend was requested, but the owning snapshot only exposed replay
progress, which also includes non-draw commands. Backend qualification therefore
remains unknown for this run. The October 10 paired-backend claim below remains
a historical report; its `scratch/runs/20261010T2116Z-darkstone` bundle is absent
on this host, so it has not been independently revalidated here. Do not replace
that historical claim with a fresh both-backend pass.

Main `99932f66b` adds endpoint-owned D3DIM completed-call counters, separately
for requested software and GPU fallback, published on existing natural fences.
Focused dispatcher/adapter tests cover endpoint isolation, flips and GL exclusion,
and throwing native calls. These counters were **not** in the Town run and are
not pixel-write counters. A fresh paired software/WebGL validation is queued;
no original 27-app membership or full-corpus completion follows from this update.

### October 19 reconciliation, without a new corpus sweep

Surface4/7 ABI support is on main `73433fabe`. The combined RTC/Surface build passed both ABI candidates, eight DirectDraw controls in both dispatch modes, and RTC native Worker/host/RPC checks. This qualifies the tested API behavior, not original-game rendering or both-backend coverage. Legacy DirectDraw Surface4/7 cube-face storage remains unsupported: CreateSurface rejects extended DDSCAPS2/3/4 with E_NOTIMPL. This is distinct from the existing Direct3D8/9 cube-resource and shader paths; those already have implementations and must not be re-created as part of the legacy follow-up. Their presence does not establish original-game or both-backend qualification.

The original September 22 report names 27 measured apps without listing all IDs. The later table below has 26 rows expanding to 37 registry IDs; it must not be relabeled as the original 27-app manifest. Recover the contemporaneous census output to establish membership. The broader goal remains every registered GL/D3D app on both backends.

### October 10 follow-up, without a new corpus sweep

- Black & White 2 has further shader fixes on main: `eaf7d0316` aligns
  create-time IR/VM acceptance, `229fffacf` applies fixed fog after ps_1_4,
  and `3a908f97b` streams software raster batches when retaining all of them
  would exhaust the allocation budget. Unit and scoped differential tests
  support those changes. The software treatment run
  `20261010T1638Z-bw2-raster-budget-boat-w6` completes 3300 seconds with zero
  failed commands in 659 samples, beyond the control's ~2214-second latch.
  This proves the scoped render fix, not completion of the game-coverage task:
  post-flyover gameplay is about 37 minutes (45 required), and the corrected
  camera comparison does not separate input from scripted camera movement.
  Ordinary control and both-backend qualification remain open.
- Age of Wonders II terrain/UI overlap was repaired by `9a438f1b9` and
  `201de22d9`, reviewed by the ops coordinator. The separate 1024x768 Start
  click route is fixed in `b6e18c196`: lazy headless presentation refreshes
  the input transform before mapping clicks. The retained route
  `20261010T1731Z-aow2-screen-click-drop` reaches the world and Julia's
  welcome card. This does not upgrade the dated software row to a fresh
  WebGL or FPS qualification.
- New-game work outside the original set now includes Beyond Good & Evil:
  `0a690ad31` registers the original demo after reviewed ordinary input,
  food consumption/health change and forward movement in
  `scratch/runs/20261010T1432Z-bge-input-consumer`. Audio, sustained FPS and
  both-backend coverage remain unqualified. CMR3 still needs correct DLL
  unload/thread-exit behavior; its held draft is not a merged fix.
- Invisible War exercises the new D3D8 cube (`60349b055`) and pixel-shader
  handle (`dc2e0d410`) paths. `6bc406dc5` preserves executable identity
  across guest threads and fixes the missing UI configuration behind the
  null-object failure. The original ten-minute run
  `20261010T1726Z-deusex-iw-loading-long` still shows loading, with 21804
  completed render commands and no queue error; it is not menu or gameplay
  evidence. Ordinary focus/Escape, including a two-second hold, does not
  dismiss loading. See its
  [investigation notes](re-notes/deus-ex-invisible-war-demo.md).

The historical measurements below remain dated observations, not current-main
passes. In particular, the newer fixes do not complete this corpus goal.


## October 13 evidence reconciliation

This updates retained evidence against main fac1dc0ba; it is not a new corpus sweep.

| App / scope | Evidence now available | Remaining gap |
|---|---|---|
| Diablo II | GPU POINTLIST fix `782bc73d4` passed 40 pixel cases and ordinary browser town/control in paired `20261013T2055Z-diablo2-pointlist-control` / `-candidate`, canonical Wasm `ba6f25ea2d467b3fba00110d83575d48ac1aeb8794a474052190998067723259`. Control 38,701 fallbacks/27,556 readbacks; candidate 0/1,001 with zero backend errors. | Those optimization arms both use WebGL. Separate `20261013T2115Z-diablo2-software-town` on2cf59bcff/ba6 now verifies ordinary town/ground movement with live software endpoint, no GPU adapter and command progress. Both backend routes therefore have reviewed browser gameplay evidence on recorded versions. Different RNG/time prevents a performance comparison; logical/display FPS, audio/device remain unqualified. |
| Neverwinter Nights (new-game extension) | Real client attributes, stencil and color masks are merged. `20261013T2045Z-nwn-color-prelude` on `99e780866` / canonical `ba6f25ea…` reaches Prelude world; ordinary ground clicks change position/camera and open Pavel conversation, then Continue advances dialogue. Root reviewed captures. Local-only corpus registration `46a456ab` merged. | Evidence is CLI software with synthetic batch clock, not browser/WebGL, FPS, audio, combat or physical-device qualification. Registered browser run `20261013T2100Z-nwn-registered-browser` now also proves Prelude ground interaction and Pavel Continue; its exact GL backend remains unattested. |
| Arcanum | Retained `20261008T1431Z-arcanum-gameplay-qualified` explicitly pins both backends, ordinary movement and module identity. | Software FPS remains unqualified; later missing-knob notes do not erase this run. |
| UT2004 | Merged `fc0d7bf10`; `20261010T2240Z-ut2004-sw-menu-input-w5` retains software DM-Rankin and Up movement. | Historical installer route, not a fresh registered-app or full backend-pair certification. |
| UT2003 | `20261010T2140Z-ut2003-server-sw-w4` and both named artifacts are present; TLS/OOM fixes are merged. | Unattended listen server does not prove player movement; module hash absent. |
| Daikatana | Retained software `20261006T1830Z-daikatana-demo-gameplay` and explicit CLI WebGL `20261010T2140Z-daikatana-webgl-w4` record world, ordinary movement and weapon pickup. Fresh browser `20261031T0256Z-daikatana-webgl` records the live GL endpoint's `backend: webgl`, inspected original world/HUD and native ArrowUp movement, with 458 unchanged input entries and 106 verified host snapshots. DLL repair remains merged. | Historical module hashes are incomplete. Fresh browser module `8333a35b…` has unknown compiled source identity; Chrome ANGLE SwiftShader is not hardware-GPU evidence. Combat, level completion and full renderer parity remain unqualified. Do not duplicate generic CLI WebGL qualification. |
| FreeSpace | Earlier codec/API fixes and retained flight evidence remain available; this is not an unresolved launch crash. | Browser/device evidence remains a separate gap. |

The falling-leaf repair, registered saver clock and headless resize fix are merged. Historical 14/14 crash revisits are retained launch evidence, not a fresh full-game certification. MilkDrop remains held after automatic review; Morrowind remains paused and Heroes II belongs to the laptop.

## How the set was measured

`node tools/gfx-app-census.js --family=gl,d3drm,d3dim,d3d8,d3d9 --list` (fixed in
`3a7b0ecb` to read every PE an app mounts and the IDirect3D IID bytes) names 69
apps that can *reach* a 3D API. Static reach is not use, so every one was run:
three CLI workers, software arm only, each app traced for the calls that create
a 3D device (`Direct3DCreate8/9`, `IDirect3D*::CreateDevice`, a DirectDraw
QueryInterface for IDirect3D*, `wglCreateContext`) and photographed. Every
screenshot cited was looked at.

- Build: wasm `2809640c` at `3a7b0ecb`. Part of group A and C ran with the host
  JS at `fa4be36a` (a mid-sweep rebase; host changes were compatible: one
  optional `exeGuestPath` field, no new imports).
- Runs: `scratch/runs/20261006T02*-<app>-gld3d-sw/` (and `T03*` for later ones).
  Machine-readable rows: the sweep JSONs named in the GLD3D TODOS record.
- **WebGL arm.** `--headless-gl` is unavailable on this box (no
  `@node-3d/webgl`/`glfw`, no display), so the WebGL column is measured in the
  page instead: `tools/web-input-probe.js --app=ID --gpu` (without `--gpu` the
  probe's Chrome has no WebGL at all), the app's software route translated to
  timed keys/clicks, a reviewed screenshot, and the console checked for
  `[d3dim-gpu] D3DIM draws on WebGL` (D3D8/D3D9 use the D3D9 bridge, whose
  backend is `webgl` unless `?d3d9-renderer=software`, with no silent fallback).
  Rows dated **2026-10-06** were measured that way at `97aae839` (runs
  `scratch/runs/20261006T1840Z-gld3d-webgl/`); older dates quote the last
  browser or headless-GL verification from the app's re-notes and are not a
  measurement at this build. The DirectAnimation saver scr_corbis also draws
  its photo grid on WebGL there.
- **Tomb Raider III follow-up:** the later page route reaches Jungle and
  ordinary Up input moves Lara toward the cave. The earlier title-only result
  was route timing: Enter must reach the title ring before its attract demo,
  then wait for the passport animation. See `48ffb5e5` and
  `scratch/runs/20261006T2030Z-tr3-web-title-input/result.json`.
- The original sweep capped runs at 120 s, so historical "menu" or "loading"
  can mean the cap, not a defect. Later scoped routes record their own limits.

## Apps that really use OpenGL or Direct3D

| app | API at runtime | software | WebGL (date = when verified) | blocker / note |
|---|---|---|---|---|
| blood2_demo | D3DIM (Device3) | **gameplay** | **gameplay** (2026-10-06, browser; in-level, HUD 100/50; `scratch/runs/20261006T1840Z-gld3d-webgl`) | — |
| tomb_raider_2_demo | D3DIM (Device2) | **gameplay** | **gameplay** (2026-10-06, browser; Venice alley) | — |
| tomb_raider_3_demo | D3DIM (Device2) | **gameplay** | **gameplay** (2026-10-06, later browser route; Jungle and ordinary movement, `scratch/runs/20261006T2030Z-tr3-web-title-input`) | Earlier title result superseded by route timing correction `48ffb5e5`; no input repair needed. |
| gta2_demo | D3DIM (Device3) | **gameplay** | **gameplay** (2026-10-06, browser; city map, HUD) | — |
| mw3 | D3DIM (Device3) | **gameplay** (cockpit) | menu (2026-10-06, browser, no input; an Escape in the page's timing QUITS the demo, exit 3); gameplay (2026-09-20) | route: Escape at batches 10-41 skips the Zipper intro |
| diablo2_demo | D3DIM (Device3) | menu (hero select) | menu (2026-10-06, browser; Single Player / Exit) | gameplay needs > 120 s |
| darkstone_demo | D3DIM (Device2) | menu in dated sweep | menu (2026-10-06, browser) | Later retained Town before/after images show champion, HUD and substantial camera rotation; root reviewed them on October 8. Original backend, module and command log were not recovered, so neither backend is newly qualified. See `scratch/runs/20261007-darkstone-retained-gameplay-audit/result.json`; do not count this as a never-played new title. |
| arcanum_demo | D3DIM (D3D7) | **gameplay + player movement** (2026-10-08); FPS unqualified | **gameplay + player movement** (2026-10-08); idle crash-site 21.56 presentations/s | current source/module/backend pinned; 434 visible submissions / 20.127 s, not scanout; retained earlier gameplay, not a new never-qualified game; [handoff](../ops/handoffs/arcanum-gameplay-20261008.md) |
| dx_boids / dx_flip3dtl / dx_tunnel / dx_twist | D3DIM | **renders** | **renders**, all four (2026-10-06, browser; `scratch/runs/20261006T1935Z-gld3d-webgl-recheck`) | — |
| mcm | D3DRM over Device2 | **gameplay** (race) | gameplay (2026-09-20); not re-run (long route) | w4 |
| dx_globe / dx_viewer | D3DRM | **renders** | **renders** (2026-10-06, browser) | globe texture seam (w4) |
| scr_architec, fallingl, geometry, jazz, oasaver, rockroll, scifi | D3DRM | **renders** (w4 rerun at `--tick-ms-per-batch=2`) | **7 savers render** (2026-10-06, browser; fallingl dark leaves and oasaver green field as on software) | fallingl black leaves, oasaver stray box: w4 |
| halflife_uplink | OpenGL | **gameplay** (corridor + HUD) | **gameplay** (2026-10-06, lazy-file browser route after `5f4bac8c`; `scratch/runs/20261006T2100Z-hl-uplink-lazy-mci/4-gameplay-webgl-lazy.png`) | MCI lazy park now waits for IO; subclassed dialog buttons receive queued mouse input. Earlier black result superseded. |
| simgolf_demo | OpenGL | **gameplay** | **gameplay** (2026-10-06, browser; course + build bar) | — |
| quake2_demo | OpenGL (ref_gl) | **gameplay + ordinary forward/reverse/idle traversal** (2026-10-08, temporary browser, guest Worker/WAT software OpenGL, accepted reference `096889e1` / module `fb1be916`; [reviewed run](../scratch/runs/20261008T000901Z-quake2-software-ordinary/result.json)) | **gameplay + ordinary forward/reverse/idle traversal** (2026-10-07, temporary browser, guest Worker/WebGL, module `fb1be916`; [reviewed run](../scratch/runs/20261007T213620Z-quake2-ordinary-traversal/result.json)) | Original ref_gl Game → Easy; support-beam approach/reverse and stable idle landmarks reviewed on both backends. Software world visible by 49.617 s after selection, WebGL by 54 s. Software endpoint selection verified in host and owning render Worker, without GL WebGL fallback. Fresh software execution uses the unchanged accepted reference host/module closure, not a new current-main build. FPS/audio/network unqualified; [software identity and cleanup](../ops/handoffs/quake2-software-ordinary-20261008.md), [WebGL identity and cleanup](../ops/handoffs/quake2-ordinary-traversal-20261007.md). Historical 2026-09-23 gameplay retained. |
| warcraft3_demo | OpenGL | **Prologue gameplay, Thrall selection and two opposing ordinary move orders** (2026-10-08, temporary browser; guest OpenGL software; reference `f62ab3c9` / module `4dc5ac2c`; `scratch/runs/20261008T0400Z-warcraft3-software-runtime`) | **Prologue gameplay, Thrall selection and two opposing ordinary move orders** (2026-10-08, temporary browser; reference `f62ab3c9` / module `4dc5ac2c`; `scratch/runs/20261008T0156Z-warcraft3-campaign-world-runtime`) | Coordinator reviewed WebGL displacement against fixed hut, stone circle and rocks; matching live host/owning WebGL and all675 contained hashes verified. Coordinator also reviewed software selection and opposing displacement against the same landmarks, verified matching host/owning software endpoints and all666 contained hashes; integrated on main `0d9515322`. No engine change. FPS/audio/combat/campaign completion and a current-main build remain unverified. [Identity, route and cleanup](../ops/handoffs/warcraft3-campaign-world-20261008.md). [Software identity, route and cleanup](../ops/handoffs/warcraft3-software-20261008.md). Historical SetPixelFormat repair `579ee802` retained. |
| ptct | OpenGL | renders, correctness unverified | beams draw (2026-10-06, browser) | 0.35 presents/s on software |
| ut2003_demo | D3D8 | menu | menu (2026-10-06, browser, no route); gameplay (2026-09-25) | each frame ~1 s on software |
| ut2003_demo_server | D3D8 | **gameplay** (listen server renders DM-Antalus) | **gameplay** (2026-10-06, browser; DM-Antalus, HUD) | — |
| ut2004_demo | D3D8 | splash at 120 s | menu (2026-10-06, browser, no route); gameplay (2026-09-25) | slow |
| alien_shooter | D3D8 | **Mission 01 gameplay, movement and firing** (2026-10-06; `scratch/runs/20261006T0612Z-alien_shooter-w4-gameplay2`) | **Mission 01 gameplay, ordinary movement and aiming** (2026-10-08; `scratch/runs/20261008T0114Z-alien-shooter-webgl`, accepted reference `f62ab3c9` / module `4dc5ac2c`) | Root reviewed player movement and opposing aim poses; live host and owning WebGL proved,109 artifact hashes verified. No engine patch. FPS/audio/combat completion/current-main build unqualified. [Handoff](../ops/handoffs/alien-shooter-webgl-20261008.md). |
| crimsonland | D3D8 | **Tutorial gameplay and movement** (2026-10-06; `scratch/runs/20261006T0500Z-crimsonland-w4-survival`) | **Tutorial gameplay, movement and aiming** (2026-10-08; owning WebGL, reference `f62ab3c9` / module `4dc5ac2c`; `scratch/runs/20261008T0105Z-crimsonland-relative-input`) | Ordinary trusted relative mouse motion establishes real menu hover before clicking; arrow keys move player/terrain and relative input moves aim. Harness correction only. FPS/audio/combat/Tutorial completion and current-main build remain unqualified. |
| pawn | D3D9 | **gameplay** (board) | board (2026-10-06, browser); gameplay (2026-09-23) | — |
| pirates_2004 | D3D9 | **menu** after `ba161dfb` + `12408feb` + `d7f5a429` | **retained sailing captures** (October 2; record reports Worker/WebGL, source commit unknown, six logs missing) | Ship displacement/date progression visible; white terrain remains. Module hash recorded as `7c5f97f5...`; source commit unknown. [Run](../scratch/runs/20261001-pirates-worker-sailing-after/result.json). No fresh backend qualification; recover provenance or revalidate. Local1371 manifest paths present (1,294,935,424bytes); lack of room for a duplicate local archive is not itself a remote-transfer blocker. |
| black_white_2_demo | D3D9 | **island flyover** (October9, normal intro/menu with Worker boot fix `efcef0022` and live relative-input opt-in); player control pending | not freshly measured | Shared PE tail mapping fixes startup. Current flyover advances but has recurring rejected draws with declaration/FVF zero, despite zero main-Worker declaration-rejection counters; origin unproven. Stale right-edge pixels and garbled menu text remain. [Live run](../scratch/runs/20261009T0335Z-black-white2-staging-fix/result.json); no ordinary gameplay/FPS claim. Historical diagnostic intro-skip gameplay remains separate. |
| morrowind | D3D8 | no reviewed software gameplay in this reconciliation | **prison-ship gameplay, forward/reverse movement** (October5; Worker/WebGL) | [Reviewed run](../scratch/runs/20261005-morrowind-prison-movement/result.json), source `94d18605`, module `2e2fd8d1`; four review-image hashes and retained module rechecked October9. Partial typing loss and inset viewport remain. Not current-main, full character creation, audio or FPS qualification. |
| age_of_wonders2_demo | D3DIM | **gameplay and army movement** (October9, `ff0c1f07b`) | not measured by this run | [Reviewed run](../scratch/runs/20261009T0306Z-age-of-wonders2-gameplay/result.json). FVF RESERVED1 stride repair prevents Miles callback overwrite; movement20→13 verified. Terrain/UI overlap subsequently repaired by merged `9a438f1b9` / `201de22d9`; October 10 re-note reports clean panels on both renderers. Raw later bundle absent on this host; current backend/control pair, FPS/audio remain unqualified. |
| winamp | D3D8 (MilkDrop) | not run (CLI) | ordinary playback/Start opens MilkDrop then illegal-operation error (2026-10-07, browser) | original1.04e passes music gate but no visualization; fault/API cause unknown, native DLL probe refusals retained ([run findings](../ops/handoffs/winamp-milkdrop-ordinary-20261007.md)) |

Glide is not in this goal's scope, but the sweep saw it: nfs3_glide_demo
gameplay; diablo2_glide_demo title at 120 s (software Glide 1-2 batches/s and
its frame fills only 512x384 of 640x480); hitman_glide_demo crashes on the CLI
software arm (NULL object call in `EngineData.dll` 0x0ff6da1f during level
load; its re-note has the browser arm getting further).

## In the census, but not 3D at runtime

The IID evidence over-reports, exactly as the census warns: a DirectDraw game
that links `dxguid.lib` carries every DirectX GUID. Confirmed 2D (or GDI) by
trace: jazz2_demo, moorhuhn, moorhuhn_2, gallinelle (probe IDirect3D2/7, never
create a device), pocket_tanks, heroes3_demo, captain_claw_demo, aoe1, aoe2,
nfs3_demo (its own `softtria.dll` renderer), ut348_demo (SoftDrv), generally,
generally_track_editor, baldurs_gate_chapters_1_2_demo, icewind_dale_demo,
scummvm_fotaq, tworld, dungeons_of_dredmor(_release) (SDL; no GL calls),
arena_gog/daggerfall_gog/ultima4_gog (DOSBox `output=surface`; `opengl` is a
config option, not pursued), scr_win98, spider, and the four DirectAnimation
theme savers (scr_corbis/fashion/horror/wotravel). aoe1 and pirates_2004 also
match through a setup.exe/dxdiagn.dll that only lists DirectX files.

## Open blockers in the GL/D3D set, ranked

1. ~~DirectX version detection~~ -- both fixed. Crimsonland: `1fdd9a64`, a
   versioned `D3D8.DLL` stub (DirectX 8.1). Pirates: the DxDiag query was
   only its error-message chooser; the real failure was `MaxTextureBlendStages`
   = 0 in our caps (`ba161dfb`), then a failed `CoCreateInstance` (Miles A3D)
   re-running its thunk (`12408feb`), then the CLI ignoring `bigMemory`
   (`d7f5a429`).
2. **Crimsonland Tutorial control qualified on both backends**: retained October 6 software movement and October 8 ordinary WebGL movement/aiming are reviewed. WebGL required actual relative mouse input for Pointer Lock; absolute page coordinates had not established the menu target. This is a harness correction, not an engine patch. Survival, combat, FPS, audio and Tutorial completion remain unverified.

3. **Throughput, not correctness**: ut2003/ut2004/arcanum
   reach gameplay only past the 120 s cap on the dated software sweep.
   Quake II's fresh ordinary software run on the accepted reference build
   reaches the world by 49.617 s after Easy, superseding its earlier cap result.
4. **Remaining WebGL coverage**: the October 6 spot checks and later TR3/Uplink
   follow-ups are retained above. Pirates has retained sailing pictures with incomplete provenance; Morrowind
   has reviewed WebGL movement, and BW2 currently reaches its ordinary island flyover.
   Their software/WebGL pairs remain incomplete, and several other rows only
   prove menus or rendering. Do not reopen
   completed spot checks or mark the overall gameplay goal complete.
5. **D3DIM PBO warning**: emulator lifecycle audit and standalone Chrome151
   reproduction are complete. The standalone4x4 case reproduces the warning
   with correct pixels; the emulator trace has216 writes/215 reads and no
   overwrite violation (one capture-end pending read). Do not queue a speculative
   renderer repair or repeat the old causal trace. Browser-side warning remains;
   performance impact unmeasured. [Receipt](../ops/handoffs/pbo-chrome151-reproduction-20261007.json).

Outside the 3D set but found here: the DirectDrawFactory IID typo (fixed
`fa4be36a`; the theme savers then run the existing DirectAnimation shim, frames
unverified until their JPGs can be decoded: skia-canvas's native binary is
missing on this box at the software sweep; the later browser photo-grid
check is recorded above); aoe2's Unicode IDirectPlay4
QueryInterface (handed to the AoE lane on the board); `PathAppendA` for
dungeons_of_dredmor (fixed by w5 `5ca54afc`).


### D3DIM asynchronous PBO warning: source audit, 7 October 2026

No proven unsafe PBO reuse yet. Do not implement the old TODO's proposed ring or fence wait from the warning alone. No engine edits, tests, browser, build or performance measurements were performed. Drakan's acceptance fixture remains unchanged.

## Exact evidence

`source-receipt.json` hashes the source copies and original MW3 console. The console contains 145 instances of the shadow-copy-discard warning. The relevant `lib/d3dim-gpu.js` at origin/main e710d101 is byte-identical to feature commit fcfa4989. The shared checkout is older: this audit deliberately uses Git object contents, not its working-tree file.

In that source, `_flip` lines 457–498 collects an existing `t.inflight` at line 468 before writing the same PBO. `_completeInflight` lines 501–520 binds `t.pbo`, calls `getBufferSubData`, unbinds and deletes the fence. The normal path therefore orders readback before reuse. No explicit `clientWaitSync` exists; synchronous collection can still block.

The dead-target branch at lines 362–365 discards an unread pending result, deletes its sync, destroys the device and removes the target. It does not itself reuse that PBO. Resizing at lines 207–212 fences before destroying/replacing the target. These branches need live identity evidence before attributing the warning to discarded reads. `_completeInflight` clears its JS pending record before GL collection; an exception would leave no retry record. A WebGL validation failure can also return normally without copying. Neither is established in the saved run.

## What Chromium actually warns about

Primary source is pinned to Chromium revision d03948c49f64c93042f36929fc9a89d1e688c6e6, **not claimed to match the installed browser revision**:

- [GLES implementation](https://chromium.googlesource.com/chromium/src/+/d03948c49f64c93042f36929fc9a89d1e688c6e6/gpu/command_buffer/client/gles2_implementation.cc), `AllocateShadowCopiesForReadback`, lines 5908–5928: warning means `Buffer::Alloc` found an already allocated internal shadow for a written/unfenced buffer. It does not inspect our JavaScript `inflight` flag.
- [Shadow tracker](https://chromium.googlesource.com/chromium/src/+/d03948c49f64c93042f36929fc9a89d1e688c6e6/gpu/command_buffer/client/readback_buffer_shadow_tracker.cc), lines 26–76: allocation persists until `Free`; successful unmap frees it. Readback validity additionally compares write/readback serials.
- [WebGL2 implementation](https://chromium.googlesource.com/chromium/src/+/d03948c49f64c93042f36929fc9a89d1e688c6e6/third_party/blink/renderer/modules/webgl/webgl2_rendering_context_base.cc), lines 354–387: `getBufferSubData` validates, maps, copies and unmaps. Validation or mapping failure returns without that completed sequence. GLES unmap frees the shadow even when mapping used the synchronous fallback (lines 5442–5453). Consequently, merely omitting `clientWaitSync` does not prove why the *next write* warning occurs. A different warning explicitly diagnoses readback without waiting.

## Existing coverage and minimal next proof

`test/test-d3dim-gpu-async-flip.js` covers one queued flip, unrelated-range deferral, original-DIB collection, global collection, and synchronous fallback. It has no repeated-flip, discard/recreation or multiple-PBO identity case. Its mock `getBufferSubData` reads a variable last assigned by `bufferData`, rather than the currently bound buffer: extend that mock before trusting identity coverage.

First proposed source-only tests, once authorized: actual executor with a binding-aware GL mock; two differently colored consecutive frames; assert collect-old before write-new and correct old/new DIB bytes. Two targets/contexts must never collect each other's buffer. Dead target discards once and recreation gets a fresh resource identity; size growth collects before deletion. Negative control removing the collect-before-reuse call must fail on overwritten old-frame bytes, not a missing helper. These prove application ordering, not Chrome shadow behavior.

Then, only under a separate serialized browser grant: one short MW3 ordinary menu diagnostic, capped 10 seconds/256 detailed events with total counters and explicit dropped-event flag. Identify the actual executor and context, then assign stable WeakMap IDs to contexts, PBOs, syncs and targets. Wrap existing `bindBuffer`, `bufferData`, `readPixels`, `fenceSync`, `getBufferSubData`, `deleteSync`, `deleteBuffer` and executor target/collect lifecycle seams. Record args, bound pack-buffer identity, byte ranges, target/backing identity, entry/return/throw and warning timestamps. Forward exactly once with original receiver/arguments/results/errors. No extra readback, wait, flush, binding, getError or pixel mutation. Restore only own wrappers, report foreign replacement. Preserve observer overhead and unknown on cap/context mismatch.

Discriminating outcomes: a same-resource second write with no completed collection supports a missed/discarded-read lifecycle; a complete ordered collect between writes refutes that simple explanation and requires checking actual Chromium revision, validation and context before a change. A returned JS call alone cannot certify successful GL copying. Do not infer GPU corruption or a performance gain from warning counts. Any performance A/B belongs on separate boats with matched useful work.

### Winamp fixture identity, October 7

Static PE resource inspection identifies `test/binaries/winamp.exe` as 2.9.1.0. The registry mounts `plugins/candidates/vis_milk.dll` (430,592 bytes), not the separate `vis_milk2.dll` (425,472 bytes, Winamp 5.6.6 strings). No Winamp 5 executable was found in the `test/binaries` filename inventory. The registered plugin itself mentions a feature requiring Winamp 2.90 or later; that does not prove its full host requirement. The older “needs Winamp 5” table entry is therefore an unverified prerequisite, not an established missing-file blocker. Next inspect the exact registered plugin initialization/version gate before acquiring a different host. No runtime result is implied. Exact hashes and resources: `scratch/sweep-reconciliation-20261007/winamp-fixture-identity.json`.

### October 7 PBO executor regression follow-up

The binding-aware `test/test-d3dim-gpu-async-flip.js` now passes on unchanged
executor SHA-256 `e3370b31c0a63aff9420dc89f044f121c87bb2140a7683f4917f199a17680b8f`.
It proves same-PBO two-frame collection ordering and distinct DIB contents,
correct currently bound buffer despite another allocation, reversed collection
of independent contexts, rejection of a foreign-context PBO, and dead-target
discard/removal without a subsequent flip reusing that target. The GPU and
surface metadata are fixture objects; this is the actual JavaScript executor,
not actual Chrome/GPU execution. Resize/recreation is not newly covered.

Under the explicit pure-JS lease, candidate PID 2407020 exited 0 and private
in-memory `--negative-control` PID 2407027 exited 1 at the intended first-frame
byte assertion: actual `[17,17,17,17]`, expected `[48,32,16,255]`. The control
removes only collection before reuse, so setup or missing exports cannot
explain that expected failure. Both processes completed within 46.221 ms total
at 08:58:53.624Z; this duration is a cleanup receipt, not a benchmark.

Receipt/logs: `scratch/d3dim-pbo-audit-20261007/test-validation.json`,
`candidate.log`, `negative-control.log`. Test SHA-256:
`f9cfd55d29972759b7595aedea386bb4cb106d390d5fa4aeb05919b6a6dba13e`.
No engine change or claim that Chrome's warning is fixed. The bounded live
context/PBO lifecycle observer above remains the next causal diagnostic.

### Registered MilkDrop initialization gate, October 7

The exact registered `vis_milk.dll` export at `0x100299c0` returns its header directly. Its initializer at `0x10029a90` contains no blanket Winamp 5 rejection at the historical music check: it queries the host using `SendMessageA(WM_USER, 0, 0)`, accepts a result at least `0x4000`, and otherwise accepts `SendMessageA(WM_USER, 0, 0x68) == 1`. Only the latter failing path shows “This plugin can't run without music” and returns failure. This identifies an older-host playback condition, not proof of successful rendering. Raw exact-PE disassembly is retained at `scratch/sweep-reconciliation-20261007/milkdrop-init-disassembly.txt`.

Current `test/test-winamp-visualizers.js` documents and exercises MilkDrop header enumeration on the existing host; its historical remaining-gap comment names cross-thread IsPlaying delivery, not a Winamp 5 dependency. Main `2dab96f8` later changed Worker-to-main SendMessage delivery and is in the pinned `3b8189f5` runtime ancestry, but its WinBoard regression does not prove the MilkDrop route. Next run the actual registered plugin with ordinary playback/Start and observe the returned playback query and D3D device creation under each relevant thread mode. Keep software/WebGL rendering unqualified until that evidence exists. No host download or new runtime was performed for this source audit.

### Retained software evidence reconciliation, 8 October 2026

Root reviewed Crimsonland `s0.png` and `s-moved.png` from the October 6
Tutorial run: terrain moves beneath the player and the HUD remains visible.
Root reviewed Alien Shooter `m17500.png` and `m-fire.png`: the soldier moves
from the road to the fence and the later image shows firing. The run records
identify source commits `95e04dd8` and `d699e4df`, respectively; both omit
WASM hashes. These are retained historical software results, not fresh tests
of current main. Neither establishes WebGL gameplay, FPS or audio.

### October 9 retained-evidence limits

Pirates sailing images were inspected again: the ship leaves Port Royale and
the calendar advances from January11 to February3. The result record reports
WebGL but the following referenced files are absent from
`scratch/runs/20261001-pirates-worker-sailing-after/`:

- `worker-stretch-isolated.log`
- `stretch-tests-4.log`
- `stretch-baseline.log`
- `stretch-caps.log`
- `stretch-build-2.log`
- `color-targets-web.log`

The screenshots alone cannot restore the missing source/backend execution
record. These are retained pictures, not newly verified current-main gameplay.
Morrowind has stronger retained evidence: review.json records W/S1200ms and
idle1500ms, four screenshot hashes match, and the retained wasm matches
`2e2fd8d1ca62cd87f0bc09312bc4836108df610d00cb7771bb5ae22755eceedc`.
DiabloII lazy-default evidence ends at ActI loading; do not promote it to
gameplay merely because its regression result says passed.

## Current-main status, 10 October 2026 (GL-D3D-CORPUS-STATUS-20261010)

One row per app that draws through OpenGL or Direct3D at runtime, combining
the best dated evidence above, the per-app re-notes and `scratch/runs`, and a
fresh two-arm probe on current main. The sections above are unchanged.

**Census.** `node tools/gfx-app-census.js --family=gl,d3drm,d3dim,d3d8,d3d9 --list`
at `c50336dcc`: **90 of 289** registry apps reach a 3D API statically (ddraw 82,
d3drm 14, d3dim 68, d3d8 13, d3d9 4, gl 25). The 21 apps registered since
the October 6 sweep are classified below. Every census app appears exactly
once, either in the 3D table or in the not-3D list.

**Fresh probes.** Boat `bx_u968n4h4` (4 vCPU, llvmpipe, Xorg `:0`, ops
services off), main `cac339517`, wasm `6a798f18`. Each run is a bounded
`test/run.js --app=ID --no-close --png`; software arm is the default
(D3DIM/D3DRM), `--d3d9-renderer=software` (D3D8/9) or `--gl-renderer=software`;
GPU arm is `--headless-gl` (+ `--d3dim-gpu` for D3DIM/D3DRM). Runs, final
frames, log tails and the probe script are in
`scratch/runs/20261010T1850Z-gld3d-current-main-probes/`. A probe without an
input route only proves boot-to-menu and a clean exit; gameplay columns cite
the routed runs.

Legend: **gameplay** = ordinary control proven in a reviewed run; **renders**
= the 3D scene draws (no gameplay concept); *menu* / *loading* = how far the
best run got; **P** = reached in the 10-10 probe on current main.

### Apps that draw through OpenGL or Direct3D

| app | API | software | WebGL / GPU | first open blocker (row) |
|---|---|---|---|---|
| alien_shooter | D3D8 | **gameplay** 10-06 `20261006T0612Z-alien_shooter-w4-gameplay2` | **gameplay** 10-08 `20261008T0114Z-alien-shooter-webgl` | — |
| crimsonland | D3D8 | **gameplay** 10-10 `20261010T0515Z-crimsonland-cli-frames` | **gameplay** 10-08 `20261008T0105Z-crimsonland-relative-input` | — |
| diehard_nakatomi_demo | D3D8 | **gameplay** 10-10 `20261010T0230Z-diehard_nakatomi_demo-gameplay` | **gameplay** 10-10 `20261010T0315Z-diehard_nakatomi_demo-web` | — |
| ut2003_demo_server | D3D8 | **gameplay** (DM-Antalus, sweep row) | **gameplay** 10-06 `20261006T1840Z-gld3d-webgl` | software row has no reviewed result.json |
| ut2003_demo | D3D8 | **gameplay** 10-10: DM-Antalus, joined, HUD 100/150, Up walks to the boulder, Left turns (`20261010T2050Z-ut-family-both-arms`) | **gameplay** 10-10 (`--headless-gl`): DM-Antalus, Up walks into a weapon pickup, Left turns (same run) | headless-GL frame drawn 4,24 px off the client origin (HEADLESS-GL-CLIENT-OFFSET-20261010) |
| ut2004_demo | D3D8 | menus 10-10 (Instant Action game-type list) but clicks land late and ~40 px high, so gameplay was not reached before the boat TTL; DM-Rankin spawn 09-29 (re-note) | **gameplay** 10-10 (`--headless-gl`): DM-Rankin spawn with bots fighting, Up moves down the corridor, Left turns (same run) | software menu input mapping (UT2004-SW-MENU-INPUT-20261010); GPU menu list boxes draw empty |
| morrowind | D3D8 | *world renders*, no reviewed software movement | **gameplay** 10-05 `20261005-morrowind-prison-movement` | software run needs a heavy route (user: no Morrowind runs) |
| winamp (MilkDrop) | D3D8 | not run | MilkDrop opens then illegal-operation fault 10-07 | MilkDrop fault (TODOS line "Diagnose original Winamp MilkDrop exception") |
| pawn | D3D9 | **gameplay** 09-23; board renders **P** | **gameplay** 10-03 page; board renders **P** | — |
| pirates_2004 | D3D9 | *menu* | retained sailing pictures, provenance gap | PIRATES-ROUTE-FOLLOWUP, PIRATES-TERRAIN-REVIEW |
| black_white_2_demo | D3D9 | island renders 3300 s, 0 failed commands 10-10 `20261010T1638Z-bw2-raster-budget-boat-w6`; control not shown | not measured since 09-15 (wrong scene then) | GAMEPLAY-black_white_2_demo |
| blood2_demo | D3DIM Dev3 | **gameplay** | **gameplay** 10-06 | — |
| tomb_raider_2_demo / tomb_raider_3_demo | D3DIM Dev2 | **gameplay** | **gameplay** 10-06 (`20261006T2030Z-tr3-web-title-input`) | — |
| gta2_demo | D3DIM Dev3 | **gameplay** | **gameplay** 10-06 | — |
| mw3 | D3DIM Dev3 | **gameplay** (cockpit) | **cockpit gameplay + forward movement** 10-10, `--headless-gl --d3dim-gpu`, 49,818 GPU draws, 0 fallbacks (`20261010T2110Z-mw3-webgl-cockpit-w5`) | — |
| diablo2_demo | D3DIM Dev3 | *menu* / Act I loading | *menu* 10-06 | gameplay needs a longer route |
| darkstone_demo | D3DIM Dev2 | **Town gameplay** 10-10, software D3DIM: camera turns under Right input (`20261010T2116Z-darkstone`, w5) | **Town gameplay** 10-10, `--headless-gl --d3dim-gpu`: camera turns under Right input, 62,238 GPU draws, 0 fallbacks (same run) | — |
| arcanum_demo | D3D7 | **gameplay** 10-10 `20261010T0810-arcanum-control-frames` | **gameplay** 10-08 (backend knob not recorded) | — |
| age_of_wonders2_demo | D3DIM | **gameplay** 10-09 `20261009T0306Z-age-of-wonders2-gameplay` | **gameplay + army movement** 10-10, page WebGL on a GPU-less boat Chrome (`20261010T1145-aow2-viewport-clip-fix`, after `9a438f1b9`) | — |
| mcm | D3DRM / Dev2 | **race P**: Stunt Quarry, riding, 200 s routed run | **race P**: same route, 225k GPU draws, 0 fallbacks | — (first current-main WebGL race since 09-20) |
| dx_flip3dtl | D3DIM | **renders P** (textured cube) | **renders P** (33k GPU draws, 0 fallbacks) | — |
| dx_globe | D3DRM | **renders P** | **renders P** (233k GPU draws) | — |
| dx_viewer | D3DRM | **renders P** | **renders P** | — |
| dx_boids / dx_tunnel / dx_twist | D3DIM | **renders** 09-23 | **renders** 10-06 `20261006T1935Z-gld3d-webgl-recheck` | — |
| scr_jazz | D3DRM | **renders P** (first dated software run) | **renders P** | — |
| scr_architec, geometry, oasaver, rockroll, scifi | D3DRM | **renders** 10-06 `…-w4-software` | **renders** 10-06 `…-w4-webgl` | oasaver stray box (minor) |
| scr_fallingl | D3DRM | renders, leaves draw as black silhouettes | same picture | SCR-FALLINGL-BLACK-LEAVES-20261010 |
| zuma_deluxe | D3D7 (9 lit-off 2D quads) + DDraw | **gameplay** 10-10 `20261010T0710Z-zuma_deluxe-control-frames-w6`; title **P** | **gameplay** 10-04 `20261004-zuma-adventure-gameplay`; title **P** (9 GPU draws) | — |
| avp_alien_demo / avp_marine_demo | D3DIM (execute buffers) | **gameplay** 10-06 (`20261006T072800Z-avp-alien-demo-forward-walk`, `20261006T073600Z-avp-marine-demo-gameplay`); menu **P** | **gameplay** 10-10, both demos in-game on WebGL (`20261010T1930Z-avp_alien-webgl-w4`, `20261010T1930Z-avp_marine-webgl-w4`) | — |
| carmageddon2_demo | D3DIM Dev2 | **gameplay** 10-06 `20261006T075600Z-carmageddon2-demo-gameplay` | **race with control** 10-10, `--headless-gl --d3dim-gpu`, accelerating among opponents (`20261010T2100Z-carma2-webgl-w4`) | — |
| carmageddon_tdr2000_demo | D3D7 | **race** 10-10: opponents racing, HUD (`20261010T2035Z-tdr2000-loader-stall-w6`). The earlier "stall" was a long CRT-heavy load: use `--batch-size=500000` | **race with control** 10-10, `--headless-gl --d3dim-gpu`, lap 1/4 with kills after Up (`20261010T2100Z-tdr2000-webgl-w4`) | software steering not separately proven |
| cmr2_demo | D3D7 | **gameplay** 10-06 `20261006T1650Z-cmr2_demo-gameplay-w6`; menu **P** | **in-race with control** 10-10, `--headless-gl --d3dim-gpu`, Sweden stage at 11 mph after Up (`20261010T2100Z-cmr2-webgl-w4`); the menu glyph blocks were fixed by `8918a13de` | — |
| colin_mcrae_rally_demo | D3DIM | **gameplay** 10-06 `20261006T061500Z-colin-mcrae-rally-demo-gameplay`; options **P** | **in-race** 10-10 `20261010T1930Z-colin-webgl-w4` | — |
| drakan_demo | D3D6 | **gameplay** 10-06 `20261006T1600Z-drakan_demo-gameplay`; menu **P** | **in-level with control** 10-10, `--headless-gl --d3dim-gpu`, on the dragon, turn and forward (`20261010T2100Z-drakan-webgl-w4`) | — |
| quake2_demo | OpenGL | **gameplay** 10-08 `20261008T000901Z-quake2-software-ordinary` | **gameplay** 10-07 `20261007T213620Z-quake2-ordinary-traversal` | — |
| warcraft3_demo | OpenGL | **gameplay** 10-10 `20261010T0330Z-warcraft3-demo-control-frames` | **gameplay** 10-08 `20261008T0156Z-warcraft3-campaign-world-runtime` | D3D8 path (registry without `-opengl`) reaches only the menu |
| halflife_uplink | OpenGL | **gameplay** 09-22 | **gameplay** 10-06 `20261006T2100Z-hl-uplink-lazy-mci` | — |
| simgolf_demo | OpenGL | **gameplay** 10-06 | **gameplay** 10-06 `20261006T0503Z-simgolf_demo-webgl-route-w5` | — |
| anachronox_demo | OpenGL | **gameplay** 10-06 `20261006T1940Z-anachronox_demo-gameplay-w6` | **gameplay** 10-06 `20261006T2030Z-anachronox_demo-web-w6` | — |
| daikatana_demo | OpenGL | **gameplay** 10-06 `20261006T1830Z-daikatana-demo-gameplay` | **gameplay** 10-06 `20261006T1910Z-daikatana-demo-web` (renderer not recorded) | — |
| descent3_demo | OpenGL | **gameplay** 10-06 `20261006T1320Z-descent3_demo-gameplay-w6`; pilot screen **P** | **in-flight gameplay** 10-10: cockpit, yaw and laser fire, energy 100 -> 99, 664k GL draws (`20261010T2030Z-descent3-webgl-flight-w4`). It needed the `lib/gpu-backend.js` fix below; before it, the run crashed at the pilot screen | — |
| baldurs_gate2_demo | **DirectDraw** as registered: 0 GL calls at startup and menu on both arms, no `3D Acceleration` key in baldur.ini (`20261010T1930Z-bg2-renderer-w4`) | movement 10-09 (native CLI, no result.json) | **gameplay** 10-10 `20261010T0146Z-bg2-browser-lock-fix` (DirectDraw) | its OpenGL path (`3D Acceleration=1`) is unexercised |
| ptct | OpenGL | **renders P** (untextured beams) | **renders P** (72 draws, 24 presents in 50 s) | correctness unverified (0 texture uploads) |
| deus_ex_demo | SoftDrv by default; D3DDrv / OpenGlDrv optional | D3DDrv on software D3DIM 10-06; OpenGlDrv intro 10-06 | D3DDrv menu + Training 10-06 `20261006T1115Z-deusex-renderer-bench` | GAMEPLAY-deus-ex-demo |

### Census apps that do not draw through OpenGL or Direct3D

The October 6 list above still holds: jazz2_demo, moorhuhn, moorhuhn_2,
gallinelle, pocket_tanks, heroes3_demo, captain_claw_demo, aoe1, aoe2,
nfs3_demo, ut348_demo, generally, generally_track_editor,
baldurs_gate_chapters_1_2_demo, icewind_dale_demo, scummvm_fotaq, tworld,
dungeons_of_dredmor, dungeons_of_dredmor_release, arena_gog, daggerfall_gog,
ultima4_gog, scr_win98, spider, scr_corbis, scr_fashion, scr_horror,
scr_wotravel. Glide (out of scope): nfs3_glide_demo, diablo2_glide_demo,
hitman_glide_demo.

New since that sweep, each with a reviewed gameplay run on its own renderer:
asghan_demo, braveheart_demo, crusaders_mm_demo and populous_tb_demo draw
with their own software renderer through DirectDraw (the registered exe; their
D3D/Glide exes are not registered). croc2_demo never calls `CreateDevice`,
even with a HAL seeded. disciples2_demo is DirectDraw only. driver_demo's
`config.exe` offers only Glide.

### Found and fixed on the way: desktop GLSL explicit LOD

`--headless-gl` crashed Descent 3 at its first GL_CLAMP draw:
`extension 'GL_EXT_shader_texture_lod' unsupported in fragment shader`.
`lib/gl-compat.js`'s border-sampling program is ESSL. The Node bridge exposes
desktop GLSL, where that extension is `GL_ARB_shader_texture_lod` and the
function is `texture2DLod`. `lib/glide-backend.js` already made that rewrite
for its own shader. `portToDesktopGLSL` in `lib/gpu-backend.js` now makes it for
every shader. `test/test-headless-gl.js` compiles such a program. On the boat
it fails with the exact Descent 3 error on unchanged main, and passes with
the fix. Browsers are unaffected: their WebGL1 knows the EXT name.

`test-headless-gl.js` was already red on main before this change, for two
reasons. Its `run.js` regex predated `HEADLESS_GL || GLIDE_RENDERER === 'software'`
(now fixed here). Later, its resize assertion
`right edge stale: drawing buffer was not resized` fails under llvmpipe both
with and without this change: HEADLESS-GL-RESIZE-STALE-20261010. Fixed in
`636e0c8b7`: once a context has drawn, Mesa keeps its drawable at the old
size until the next swap, so `resizeContext` now swaps once after resizing.

### What is still open, in order

1. **Pairs still short of gameplay** (GL-D3D-PAIRS-20261010, split on the
   board 2026-10-10 20:40Z). Closed on 10-10: avp_alien/marine, colin_mcrae
   and descent3 on WebGL (w4); aow2 on WebGL (w5); mcm on both arms; tdr2000
   on software (w6); the cmr2 WebGL glyph blocks (`8918a13de`); driver_demo's
   Glide path on WebGL (`--headless-gl`, llvmpipe on a boat Xorg): the "Lose
   the tail!" chase with its HUD, GAME OVER at 01:04.48 without input as on
   software, and with `'` + Z the car burns out, turns and reaches the garage
   exit past 01:04 (d10ba697,
   `scratch/runs/20261010T2200Z-driver_demo-glide-webgl-d10ba697`).
   Closed later on 10-10: mw3 on WebGL (w5); cmr2, tdr2000, drakan and
   carmageddon2 on WebGL (w4); ut2003 on both arms and ut2004 on WebGL
   (1863d2b5); darkstone_demo on both arms (w5).
   - **Still open:** diablo2_demo on both arms (w6); the daikatana and arcanum WebGL backends and a ut2003_demo_server
     software result.json (w4). The historical UT2004 software menu-input
     blocker is superseded by October31 `fb698d57e` and the reviewed
     DM-Rankin browser gameplay evidence above; this does not qualify WebGL.
   - **Not split:** bg2 is DirectDraw as registered.
2. **Heavy D3D8/D3D9 titles**: Pirates (PIRATES-* rows), BW2
   (GAMEPLAY-black_white_2_demo), Morrowind software (heavy route needs user
   sign-off).
3. **Wrong pictures**: scr_fallingl black leaves on both arms
   (SCR-FALLINGL-BLACK-LEAVES-20261010), ptct untextured.
4. **Fault**: Winamp MilkDrop (existing TODOS row).

## Current-main refresh, 11 October 2026 (GFX-CORPUS-MATRIX-20261011)

**Census.** `node tools/gfx-app-census.js --family=gl,d3drm,d3dim,d3d8,d3d9 --list`
on `4cbde5326`: **92 of 294** registry apps reach a 3D API statically (ddraw 82,
d3drm 14, d3dim 68, d3d8 13, d3d9 4, gl 24). Three of today's registrations
are absent only because their executables are fetched, not kept, on the ops
box: `re_volt_demo`, `forsaken_demo`, `midtown_madness_trial` (all DirectX 5/6
D3DIM, run below).

**Probe.** Boat `bx_az67mx8t` (4 vCPU, llvmpipe, Xorg `:0`, ops services off),
main `4cbde5326`, the 10-10 `probe.js`: one unrouted `test/run.js --app=ID
--no-close` per arm, **35 s wall clock**, final frame as PNG. Software arm is
the default (D3DIM/D3DRM), `--d3d9-renderer=software` (D3D8/9) or
`--gl-renderer=software`; GPU arm is `--headless-gl` (+ `--d3dim-gpu`). Up to
three probes shared the 4 vCPUs, so batch counts are lower than an idle box.
Apps that stop on a start-up dialog were re-probed with Enter at batches
30/90/200/400 and `--stuck-after` raised. Frames, logs, summaries and the
scripts: `scratch/runs/20261011T0600Z-gfx-corpus-matrix-w4/`. This is a
regression sweep at a fixed short budget; the gameplay evidence in the 10-10
table still stands where the probe reached the same point.

| app | software (35 s) | GPU (35 s) | note |
|---|---|---|---|
| dx_flip3dtl, dx_globe, dx_viewer, dx_boids, dx_tunnel, dx_twist | renders | renders | samples animate per presented frame, so final frames differ by arm |
| scr_jazz, scr_rockroll, scr_fallingl, scr_geometry | renders | renders | |
| scr_architec | white at 35 s; renders at 60k batches (series) | same | a long first load, not a fault |
| scr_scifi, scr_oasaver | **uniform frame** through 2.9M batches (120 s) on the default CLI clock | same | render with the 10-06 flags `--tick-ms-per-batch=2 --dx-surfaces` (scifi 237,900-byte frame): D3DRM-SCR-DEFAULT-CLOCK-UNIFORM-20261011. **Resolved:** a clock artifact (scene timers expire before the first Flip, so the device is rebuilt every frame); the seven savers now register `cliTickMsPerBatch: 2`, see `re-notes/plus98-dx-screensavers.md` |
| tomb_raider_2_demo, tomb_raider_3_demo | in-level after Enter on the setup dialog | same; identical frames at batches 60k/120k | |
| gta2_demo, darkstone_demo, cmr2_demo, colin_mcrae_rally_demo, avp_alien_demo, avp_marine_demo, blood2_demo, mw3, diablo2_demo | menu | menu | |
| drakan_demo, mcm, midtown_madness_trial | menu after Enter on the start-up message box | same | midtown: vehicle menu; mcm: profile name entry |
| carmageddon2_demo | intro, then exits itself (code 0) at ~112k batches | same | unattended only; the 10-10 routed race is unaffected |
| zuma_deluxe | black at 35-40 s; title at 100 s | — | slow load, not a fault |
| re_volt_demo | Acclaim splash (8.4k batches in 35 s) | same | new; menu not reached within budget |
| **forsaken_demo** | **dies**: guest heap exhausted, `Unable to allocate thread TLS vector` | same | FORSAKEN-HEAP-EXHAUSTION-20261011; w5's routed command (`--batch-size=200000`, 700 batches) still runs clean |
| pawn | board | board | |
| crimsonland, alien_shooter, ptct | launcher / setup dialog | same | need their routes |
| quake2_demo | menu | menu, 1.78M GL calls | |
| descent3_demo | pilot screen | same, 352k GL calls | |
| anachronox_demo | intro | intro, 36k GL calls | |
| halflife_uplink | menu | menu, 0 GL calls within 35 s | slow start (7.4k batches) |
| warcraft3_demo | menu | menu, 504k GL calls | |
| daikatana_demo | menu | menu, 1.94M GL calls | |
| serious_sam_demo | first-run message box | same | needs the registered route (re-note) |
| **quake3_demo** | not run | not run | fixture: QUAKE3-FIXTURE-INSTALL-STEP-20261011 |
| winamp | main window | main window | MilkDrop not exercised |

Not re-probed (heavy, or fresh 10-10 evidence): arcanum, aow2, tdr2000,
diehard, deus_ex, ut2003/ut2004, morrowind, pirates (Codex), bw2.

**Regressions since 10-10: none found.** Every app that reached a point on
10-10 reached it again on both arms, and the two arms agree wherever they can
be compared at the same batch. New failures: Forsaken's heap exhaustion on an
unattended run, quake3's unreproducible fixture, and the scifi/oasaver
default-clock frame.

## Historical census recovery anchor — 18 October 2026

The original tool addition is commit `2d722ab3766c288d13796ed9dad3f1ceeca8f1eb`
(22 September). Its commit message independently records 27 OpenGL/Direct3D
apps among 225 registry apps, seven `scr_*` D3DRM screensavers, and the
launcher-noise cautions for `icewind_dale_demo` and `tworld`. The retained
`project_gl_d3d_corpus_goal.md` memory identifies the originating session as
`bd610256-7b4f-4ed1-afa0-9c3cf3412fbb` and records family counts GL7, D3DRM10,
D3DIM9, D3D8 7, D3D9 2 with overlap.

Neither source enumerates all 27 IDs. A matching transcript/census output was
not found in the checked local Claude project files. This narrows recovery to
the original tool and registry revision plus the contemporaneous binary
inventory, or the originating session's saved output. Re-running today's
tool against today's registry is not equivalent; scanning old registry paths
against changed/missing binaries is also insufficient without identity checks.
No historical census was rerun here and no membership or backend qualification
is inferred from the counts.

### Current registry availability audit, October 19

[Machine-readable inventory](gfx-corpus-current-inventory-20261019.json) pins main `4b0c7d8b3` and the matching scanner hash. All 347 registry entries were considered against files available on this coordinator. Static names/imports/IIDs identify 201 graphics candidates, 135 with a family beyond DirectDraw; these are potential routes, not runtime coverage or gameplay passes. IID-only matches can be false positives.

Thirteen entries lack one or more directly declared executable/DLL paths, and eleven also lack their local file manifests. The inventory records exact missing paths per app. A missing manifest prevents discovery of its companion modules, so an empty family set is not proof of no 3D use. Recovery is needed for those entries; it does not block validation of other available originals. This is the current registry snapshot, not a reconstruction of the missing September 22 historical 27-ID set. Software/WebGL runtime evidence and reviewed gameplay remain separate requirements.
