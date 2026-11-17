# Boids launch/window/capture harness, 16 November 2026

The exact original browser branch now shares its readiness, identity and
complete-display capture driver with an authored native public-COM fixture.
This is a harness repair, not a production rendering fix. The November 7
serialization repair and earlier original outcomes remain unchanged.

Evidence: `scratch/runs/20261116-boids-native-window-capture-harness-repair/`.

## Contract

Preparation compiles and freezes Git source and its module in memory under a
separate fixed 240-second bound with an independent 260-second watchdog.
Only completed preparation permits a new fixed 300-second runtime, with an
independent 320-second watchdog armed before browser launch. A preparation
failure cannot become an original attempt. Existing deadlines are never extended.

The driver selects the named registered app, waits for its actual visible
top-level window and displayed renderer ownership, and pins object identities,
process ID, HWND, instance, guest Worker and render endpoints. It refuses
absent, foreign, replaced, stopped or ambiguous owners. WebGL additionally
requires an initialized actual executor with submitted rendering records or
completed draws. A scalar instance/Worker boolean alone cannot admit capture.

The production `requestCurrentDisplayCapture` returns both complete source
and displayed-output RGBA arrays. The driver checks completion, dimensions,
owner, readback timestamps and controller delivery under one 5-second capture
bound, capped by the original fixed runtime deadline. Failed, pending,
UNKNOWN or late results close that driver permanently. No retry occurs.

## Native qualification

The authored PE sleeps 1,500 real milliseconds before ordinary CreateWindow,
then calls public DirectDraw/Direct3D COM methods. Its ordinary native
GetPixel verifies COLORREF `0xcc4433`. It then idles using Sleep. The reference
expects RGB `(51,68,204)` within the literal 640×480 native primary, transparent
untouched source outside it, and opaque black displayed background. The full
output oracle uses the returned public viewport with nearest sampling.
Every component of both complete frames is compared, without sampling or
changing the reference to match a failure.

`final-software-worker` passed three complete captures: 1,228,800 source
pixels and 1,185,280 output pixels per frame. Native ownership controls reject
absent app, wrong process, replaced window, replaced renderer and bad Worker
readiness against the real production owners. The readiness record includes
polls during the delayed native window creation. Actual page, guest Worker
and render Worker modules match SHA-256
`83703369cc49c3e16077a4abd43def27262487f83dd52583d1b433adf7095f5f`.
The output was visually inspected at full size.

The earlier continuous-draw fixture correctly refused an in-flight paint and
returned no frame. The initial WebGL fixture timed out at the inherited CDP
12-second bound. That bound was subsequently removed in favor of the fixed
runtime deadline. Later passive native-fixture observations found an actual
WebGL Worker consuming LAYOUT records, with zero geometry draws; successful
native software pixels do not establish native WebGL geometry. Those failed
qualification runs remain separate and cannot authorize a WebGL original.

The final `capture-webgl-worker` subsequently passed three full-frame literal
comparisons and all real-owner fault controls. It pins the actual initialized
WebGL endpoint and native software window independently. The endpoint reports
two LAYOUT records and zero geometry draws. This qualifies the shared capture
driver on this requested route, while explicitly providing no native WebGL
geometry proof. The new Device7 authored input retains the same literal pixel
reference. `final-software-coop` also passed three complete literal frames and
the native owner controls. A final software Worker run pins the identical
driver bytes used by the published harness after the WebGL readiness change.

The focused observer/driver controls, complete-display endpoint tests,
draw tracing and GPU-stream decoder passed. Canonical fullflock build passed
with actual tool exit 0; its shared outputs were released. The immutable
runtime uses Git `a00eb35bebb621ebb3f2b42b6af18f1bd874b9f6`, independent of
foreign uncommitted rendering work and shared build outputs. All original
media are referenced by existing path and SHA-256, never copied.

## Authorized original outcomes

Harness commit `840cd90f72649e7ed1f0c9ecc65253f738a97134` was committed and
strictly pulled/pushed before originals. Each configuration launched exactly
once with its own preparation and fixed runtime deadlines. All four reached
the real selected `Boids2 Sample` window, HWND 65537, process 1000, 640×480.
These are actual per-runtime identities, not guessed constants in the driver.

| Original configuration | Current result |
| --- | --- |
| Software / cooperative | Three complete frames, publications 163, 338, 655. Terrain and birds change naturally; the last frame clearly shows a multi-bird colored flock. |
| WebGL / cooperative | First capture refused pending host surface publication. No frame and no retry. |
| Software / actual guest Worker | Live guest endpoint 1 and legacy software render endpoint 1; 67 completed software draw calls at readiness. First capture refused pending host surface publication. No frame and no retry. |
| WebGL / actual guest Worker | Live guest endpoint 1 and `d3dim-gps` WebGL render endpoint 1. At readiness its executor reports 67 draws, 5,062 vertices, 1,154 triangles and one present. First capture refused pending host surface publication. No frame and no retry. |

The selected original images are `original-software-coop/frame-0-output.png`,
`frame-1-output.png` and `frame-2-output.png` in that same directory. All were
personally inspected at full size. The first shows scattered birds; the
second mostly terrain with an edge bird; the third shows the flock. This is
bounded original rendering evidence, without a claim that all 13 birds or
130 bird triangles are individually visible or independently identified.

All three complete native sources are 640×480 and displayed outputs
1280×926. Their public viewport records an uncropped 640×480 source at native
origin (0,0), displayed in destination (22,0,1235,926). The native window,
process and renderer remain pinned across captures. Software/cooperative
has no decoded public GPU command trace, so world/view/projection matrices
are unavailable for this successful sequence; no private state was read to
fill that gap. Failed captures provide no frame-aligned transform proof.

The WebGL Worker statistics distinguish geometry execution from texture
upload alone. They still cannot establish visible flock pixels without a
complete frame. The launcher forces ANGLE/SwiftShader, `/dev/dri` is absent,
and the advertised Intel/Mesa string is not hardware evidence. The authored
WebGL capture fixture itself had zero GPU draws and retained its explicit
software-output classification.

All four originals compile immutable Git `840cd90f7` before their runtime
budget; their module remains SHA-256 `83703369cc49c3e16077a4abd43def27262487f83dd52583d1b433adf7095f5f`.
All 152 original executable/media posthashes match. The compiler and served
source are independent of foreign rendering WIP; no production renderer was
changed. The source preparation negative control exits in preparation with
no browser or original launch. Two exploratory overstrict geometry-readiness
fixtures exhausted their original fixed runtime deadlines; their timeouts
remain timeouts. No deadline was extended or reused.

Native parents and independent watchdogs have actual waits and both pipe
EOFs. Original Chrome parents closed with code 0. Host browser closure is
not ordinary guest Quit. Final PID/port/profile checks, hashes and selected
frame/viewport receipts are retained in `result.json` and its local artifacts.
The process audit covers recorded parents/watchdogs/browser PIDs, not every
transient Chrome descendant or Worker thread. No box or additional worker
was created: box ID null, state NOT_CREATED, expiry null, stop N/A.

The remaining concrete blocker is complete-display capture during pending
host surface publication on the three active routes. Its refusal is not an
independently demonstrated renderer defect. No original input, camera/config/
media/EXE change, synthetic clock, private game-state probe, diagnostic fence,
capture retry or renderer fix was used. Native reference/backend parity,
hardware, unrestricted full-flock coverage, full27, gameplay, FPS and audio
remain open.
