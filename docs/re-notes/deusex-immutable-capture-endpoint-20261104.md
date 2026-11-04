# Natural presentation to immutable readback

The production host/renderer now exposes a one-shot immutable Canvas2D
readback at an ordinary successful repaint. This closes the missing link from
actual selected presentation source and completed host composition/display to
retained pixel bytes. It does **not** close the full Deus Ex engine/actor
capture contract. Engine render completion, owning Worker/slice, verified
engine viewport → player, per-layer provenance, and Chromium screenshot
correspondence remain unavailable. No engine/actor identity is synthesized.

See [the natural-frame obstruction](deusex-natural-frame-capture-20261104.md)
and [display failure propagation](deusex-display-failure-propagation-20261104.md).
Evidence: `scratch/runs/20261104-deusex-immutable-capture-endpoint/`.
The pre-change source is Git
`eef09d6881329f916577eb6ac78e93e36f398d6d`; the run records the exact tested Git
base, relevant binary diff including new-file patches, final commit, and full
SHA-256 evidence manifest. Git is the source archive; no source tree, media or
module copy was made.

## API and actual transaction

`WineAssembly.requestImmutableCapture()` forwards to its renderer and returns
a frozen ticket. It does not call `_presentNow`, upload pixels, schedule a
repaint, release a hold, run guest code, or consume input. There is one pending
request per renderer; another request throws until that request is admitted
or cancelled. With no subsequent natural repaint it remains pending; the
caller can cancel it. No timer, promise callback, or automatic retry is added.

```js
const ticket = wine.requestImmutableCapture();
// Allow ordinary execution/presentation to continue.
// ticket.status: pending | complete | failed | cancelled
const capture = ticket.read(); // null until complete; fresh byte copies thereafter
// capture.metadata, capture.sourceRGBA, capture.outputRGBA
```

Only an unheld, nonnested `repaint()` admits the request, before its actual
`_repaintOnce()`. The compositor snapshots the selected top-level window stack
at selection, including exclusive stack trimming. This is selection metadata,
not a claim that every selected window/backing was drawn or a complete list of
child, GDI and DX layers. Existing layer composition remains authoritative.
The actual display call returns its selected source, actual output canvas and
filter backend. Direct CSS display uses the logical canvas; filtered display
uses the final presentation Canvas2D canvas, including the filter's existing
GPU-to-Canvas2D blit; headless display identifies logical-canvas output.
An exclusive source is retained separately from the logical desktop.

After successful display, within the same synchronous repaint, the request
copies the selected source and output RGBA using Canvas2D `getImageData`.
Readback does not flush guest-backed canonical surfaces: where such a canvas
is encountered it uses the existing bound raw canvas-cache reader. Each
readback is limited to 16,777,216 pixels. The retained arrays are private;
`read()` returns copies, so caller edits, later source changes and future
publications cannot change retained bytes. Metadata, selected window records,
presentation viewport and its crop rectangle are frozen copies. PNG encoding
can consume these arrays later; no PNG or CDP screenshot transport is installed.

`metadata.publication` counts successful host repaint/display transactions on
this renderer. It is neither an engine-frame identity nor a browser compositor
fence. `completion: 'canvas2d-readback'` describes the actual synchronous byte
read, and `engineRender`, `viewportPlayer`, and `workerSlice` are explicitly
`null`. The presentation viewport describes renderer cropping/scaling only;
it is not an Unreal engine viewport or player relation. A readback does not
include HTML desktop layers, CSS scaling, browser overlays or Chromium's final
screen composition. Backend strings report actual filter dispatch, not GPU
hardware identity or proof of a particular GPU's pixels.

Display-only calls (including caret presentation) cannot fulfill requests.
Failed composition or false/throwing display fails the admitted ticket and
propagates the original display error. It cannot promote an earlier candidate.
A later display-only call or normal recovery cannot revive that ticket.
Tainted/unavailable/oversized readback fails only that ticket after successful
publication; it does not turn normal presentation into a fatal error. A new
request waits for a new natural repaint and has no cached-result fallback.
The previous capture/approval helpers are unchanged: pending/input/crossed
publication and inspection guards are not weakened. Full-contract consumers
must still reject missing engine/actor/layer/screenshot provenance.

## Executable checks and limits

`test/test-immutable-capture-endpoint.js` executes actual current host,
renderer, compositor, RasterCanvas and PresentationFilter modules. Six named
cases cover normal host publication, selected source/output pixels and sizes,
private copies and frozen nested metadata, stale and crossed-source orderings,
Worker holds and nested repaint, display-only noncompletion, cancellation,
false/throwing display failure and recovery, tainted/oversized readback,
direct/headless paths, and actual separate exclusive source/viewport selection.
The dimension-limit fixture changes only the returned output descriptor after
an actual display to avoid allocating an oversized canvas.

`base-run.cjs` loads the recorded pre-change host/renderer from Git into
memory and runs the same final test file: all six fail because the endpoint
is absent. All six pass afterward. Mutation controls that expose retained
arrays, capture before successful display, or bypass the Worker hold each
fail the final suite. Logs retain the initial fixture error (redefining a
nonconfigurable width); the corrected size-limit fixture does not allocate a
large canvas. No production failure is inferred from that fixture mistake.

Focused display-failure, host rAF/Worker bootstrap, Worker repaint, Worker
input wake, filter, OpenGL/GDI order, GPU-layer client origin, wallpaper,
callback-census mutation and reconciliation checks pass, as do automatic test
tier membership and the serialized full build. The required census update
changes only reviewed host/renderer hashes and appends the synchronous
capture review; broader callback ownership remains pending.

These are offline actual-module control-flow and software pixel checks.
No real WebGL/browser/Deus Ex execution was authorized or performed. GPU
readback validation, engine completion and verified viewport-player ownership
remain unresolved; the historical 735→736 screenshot remains rejected.
This production endpoint is usable for immutable host-canvas capture, and is
only one part of the full bounded game capture mechanism.

No assigned box: ID/state/expiry are not applicable. No runtime, browser,
game, allocation, lifecycle action, guest mutation, synthetic repaint,
subworker, successor, deployment or Heroes II work occurred. Coordinator
runtime ownership remains unchanged.
