# Dungeon Keeper page Canvas2D binding, 7 November 2026

`tools/dungeon-keeper-canvas-binding.cjs` provides a Canvas2D variant of the
retained original capture/admission driver. It uses the existing production
`WineAssembly.requestImmutableCapture({hwnd})` endpoint and waits for an
ordinary owner-selected publication. It never requests a D3D endpoint, forces
a repaint, releases a guest hold, or changes guest memory, clocks or handlers.
The original game was not run in this assignment. Original gameplay, digging,
FPS, audio and parity remain untested.

The retained D3D-only driver failed against the same live software sample on
which the new binding passed. This reproduces the binding incompatibility
without repeating the original runtime. The earlier original credits evidence
and route are documented in `dungeon-keeper-original-live-20261107.md`.

The binding requires one live isolated registered app, its actual guest Worker,
one visible top-level window owned by the host's process and page instance,
the actual screen/renderer/context objects, no active D3D endpoint, and a live
page CDP target. It recovers executing WebAssembly bytecode through CDP in
both page and guest, checks their hashes against the immutable staged module
pins, and requires matching page/guest module hashes. Two stable owner reads
must show advancing natural publication before readiness succeeds. Missing or
ambiguous owners fail; they do not select a convenient substitute.

All 18 retained identity comparisons remain exact, with four additional
comparisons for window instance, output canvas, context and presentation kind.
For compatibility with the retained identity schema, `renderEndpoint` now
holds the actual HWND, `renderEndpointObject` the actual window token, and
`renderWorkerObject` the actual page WebAssembly instance token. These are
explicitly qualified by `presentationKind: page-canvas2d`; they do not describe
an invented render Worker. `rendererTarget` is the page target and
`rendererEpoch` combines document, window and instance object tokens. These
are continuity tokens, not engine-frame or simulation epochs.

Captures contain PNG bytes encoded from the endpoint's immutable output RGBA,
with its selected window/process, composition and publication metadata. The
capture timestamp starts before requesting readback, so waiting cannot make
pixels appear younger. Admission preserves the 120-second freshness limit,
requires the exact latest reviewed hash and identities, and rejects publication
regression. Capture/identity/partial-input failures close the chain. Only a
zero-effect stale review refusal permits a fresh capture. The existing exact
numbered ACK transport and independently armed UP implementation remain intact.

Focused execution is retained in
`scratch/runs/20261107-dungeon-keeper-canvas-binding/final-focused/`.
The actual production route was
`/index.html?debug&candidates&no-log&gl-renderer=webgl&app=dx_ddex4`,
using the existing installed animated DirectDraw SDK sample. It ran the normal
page, host, Win98Renderer and guest Worker, with zero active render endpoints.
The immutable capture reports `canvas2d-readback`, `canvas-nearest`, process
1000, HWND 65537, and a selected 640x480 exclusive window. I visually reviewed
the red sprites over a blue checkerboard and the “Press F12 to Exit” caption.
The recovered page/guest module is SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
This identifies the executing binary; it does not assert that the preceding
source commit freshly built that binary.

`canvas-controls.json` records passing actual page-publication and guest-slice
progress; actual window, renderer and screen-canvas replacement; window/module
ownership mismatch; wrong expected executing module; altered recovered page
module observation; regressed publication observation; and stale refusal plus
fresh recapture. Negative admission effects were zero. Faulted module and
publication observations were injected at the driver's CDP observation
boundary, without changing executing modules or guest memory. Page ownership
replacement controls restore their page metadata afterward.

Five isolated commands used the actual numbered request/consumer, binding
admission, Chromium native key delivery and pulse implementation together:
normal, delayed DOWN acknowledgement, wrong ACK ID, UNKNOWN DOWN acknowledgement,
and missing ACK. Each delivered one trusted DOWN and one trusted UP. UP was
armed before DOWN and attempted after 60 ms in every case; the delayed DOWN
acknowledgement arrived after UP. Wrong/missing ACK and UNKNOWN outcomes closed
their lanes, and subsequent commands were refused. No held lane was retried.
Existing HTTP closure, deferred observer, deadline and broader fixture
qualification from `20261107-dungeon-keeper-local-driver` were reused rather
than rerun. An initial real Calculator check correctly refused readiness when
natural publication ceased advancing; no native input was admitted there.

The focused controls and ten production immutable-capture endpoint tests pass.
The required locked build, `flock /tmp/wine-build.lock bash tools/build.sh`,
also passes; its log is retained in the owned run directory. No emulator or
renderer implementation changed. Recovery records include Git source SHA,
relevant uncommitted binary patches, helper patches and runtime served hashes;
there is no source/media archive or copied game media. The focused browser
closed normally with empty held input, and its server/profile were removed.
The local runtime disk guard remained at 2,000,000,000 bytes; no floor event
was recorded. No boat was created or manipulated: box ID/state/expiry and
lifecycle handback are not applicable.

For the separately scheduled successor original attempt, stage this tracked
helper and point the retained browser's `bound` import at it. The retained
browser already records its page target and page WebAssembly scripts in the
same map as its guest Worker targets; keep that instrumentation, expected
module pins, numbered transport and independent release implementation. Leave
`app` as `dungeon_keeper_demo` (the helper default), preserve the original
registered route, and review fresh owner-scoped original pixels before input.
A changed/multiple owner or absent natural publication remains a prerequisite
failure, not permission to relax the checks. This bounded binding task is done.

Owned JSON parsing and evidence-file containment pass. The repository-wide
evidence checker still reports the preexisting unrelated Alice containment
error and historical missing artifacts; it reports no error for this run.
