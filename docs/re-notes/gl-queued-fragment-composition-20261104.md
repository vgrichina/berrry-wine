# Queued fixed-function fragment composition — 2026-11-04

`test/test-opengl-queued-fragment-composition.js` adds actual queued native
pixel coverage after the triangle alpha repair in `8fe71d6f0`. Both shipped
modules pass; this task demonstrated no additional production renderer defect
and changes only the test and this note.

Run from the repository root:

```sh
timeout 180s env GL_QUEUED_FRAGMENT_COMPOSITION_EVIDENCE=scratch/runs/20261104-gl-queued-fragment-composition/pixels-final.json node test/test-opengl-queued-fragment-composition.js
```

The test loads each existing `build/wine-assembly{,.compat}.wasm`, loads the
existing `test/binaries/calc.exe` solely to initialize ordinary PE/API dispatch,
creates a window/DC/pixel format/WGL context, resolves GL exports through
LoadLibrary/GetProcAddress, and invokes them through real x86 PUSH/CALL/RET.
It checks stdcall cleanup and valid-input GL errors. It does not run Calculator
as an application.

The native WAT producer sends its software draw descriptors into the unchanged
production `D3DCommandStream.Encoder`. The encoder copies its normal state and
packed geometry records into shared queue packets. An actual Node
`worker_threads.Worker` runs the unchanged `lib/d3d-render-worker.js`, instantiates
the same compiled module over shared process memory, consumes those packets,
and calls native `gl_sw_worker_draw`. The GL host bridge services ordinary
context/state stream traffic with its software backend. No test rasterizer,
synthetic draw record, or source-only assertion supplies the pixel result.

The fixture delays delivery of the first published batch message while leaving
the production packet, encoder, and consumer unchanged. Before delivery it:

1. Queues a full-viewport RGBA MODULATE → half linear fog → SRC_ALPHA /
   ONE_MINUS_SRC_ALPHA draw over a nonzero RGBA destination.
2. Binds a second preloaded RGBA texture, changes fog color and its end distance,
   reuses the fog setter's guest input buffer, and changes blending to ONE /
   ONE_MINUS_SRC_ALPHA.
3. Queues another quad over the right half of the first draw. It asserts two
   native enqueues, no intervening fence/completion, and an unchanged canonical
   destination surface before releasing delivery.

ReadPixels fences the real consumer. Every pixel in both halves must match an
independent normalized equation oracle (RGBA8 tolerance three). The left half
therefore checks the first draw's captured old state; the right half checks the
second draw's changed state and its composition over the first. Counterexamples
must differ visibly: texture/fog/blend reordering, fog altering alpha, omitted
texture alpha, stale second texture/fog/blend, missing first draw, reversed draw
order, and first draw using the changed state.

Finally a third queued red overlay uses DST_ALPHA / ONE_MINUS_DST_ALPHA. Its
RGB result exposes the alpha stored by both previous compositions. Per module,
the test verifies three consumed native draw records, six rendered triangles,
and zero synchronous fallbacks.

Observed RGBA values (identical in both modules):

| Region | Composition actual | Oracle | Destination-alpha witness actual/oracle |
| --- | --- | --- | --- |
| Left, old captured state | 114,68,172,116 | 114,68,172,116 | 178,37,94,92 |
| Right, first then changed state | 231,56,109,194 | 232,56,109,194 | 249,13,26,95 |

Evidence is in `scratch/runs/20261104-gl-queued-fragment-composition/`:
focused logs and per-module pixels/stats, locked full build log, provenance
with Git SHA and existing module/PE/dependency path SHA-256, and binary diffs
including the owned new-file patches. Git remains the source archive. No
source tree, module, media copy, snapshot, or tar was created.

An initial test-development attempt tried an in-flight TexSubImage2D. The
current public canonical upload path requested a fence, incompatible with the
fixture's deliberately withheld packet. That attempt was terminated and its
logs retained; the test now uses a texture binding change so both draws can
remain queued across state mutation. A guard fails immediately on any unexpected
fence during the delivery hold. This is not evidence of a production defect.

Validation: focused test on both modules, adjacent synchronous fragment
composition test, and `flock /tmp/wine-build.lock bash tools/build.sh`.
The final focused run follows the locked build.

Scope: actual native queued software pixels and readback in Node. This does
not qualify WebGL1/2, browser GLRenderHost early acknowledgements/shared endpoint
routing, presentation, gameplay, or any application corpus. No Chrome, heavy
runtime lock, boat allocation, or remote runtime was used. Box ID/state/expiry:
N/A. Coordinator retains future allocation/shutdown ownership. No additional
runtime or production repair is required by this bounded result.
