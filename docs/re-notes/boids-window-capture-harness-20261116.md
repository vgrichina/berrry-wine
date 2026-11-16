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

Conditional original outcomes and final lifecycle evidence will be recorded
after the published harness qualification. No original guest input,
configuration/media/EXE change, synthetic clock, private game-state probe,
new diagnostic fence, renderer fix, FPS or full27 claim is authorized by
these fixture results. No box or additional worker was created.
