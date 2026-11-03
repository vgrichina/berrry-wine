# GL 1.1 selection and feedback — 2026-11-03

Input: published `4ec8732baf48926004fa710f5d8a827baf21d9b5`.
Worker evidence: `scratch/runs/20261103-gl-selection-feedback/` (ignored).

## Scope and reference

Implements `glFeedbackBuffer`, `glSelectBuffer`, `glRenderMode`, `glPassThrough`,
`glInitNames`, `glLoadName`, `glPushName`, and `glPopName` through real public
stdcall dispatch, including dynamic lookup. The reference is the primary
[OpenGL 1.1 specification](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf),
sections 5.2 and 5.3 (selection and feedback), with display-list rules in 5.4.
Original pinned MDK2 gameplay remains **unqualified**. The prior inventory had
24 missing names; this change addresses this coherent eight-function family
and does not implement other families to reduce that count.

## Implementation

Selection and feedback are synchronous producer operations. Complete primitive
records enter the existing transform, homogeneous/user clip and face-culling
pipeline before any draw is published to either raster backend. Polygons retain
their logical boundaries through clipping, rather than feeding triangulation
diagonals. Points and lines use all clip planes. The normal renderer resumes
through its existing queue once RenderMode returns to GL_RENDER.

Each context owns its buffers, mode, counters, 64-deep name stack and pending
hit. Successful name operations and mode transitions flush selection records
with clipped window-depth minima/maxima mapped to unsigned 32-bit values.
Overflow writes only the available prefix and returns -1. Feedback emits
pass-through, point, line/reset, polygon and raster tokens, all five RGBA vertex
formats, clipped/interpolated attributes, clip W and generated/transformed full
texture coordinates. Clear and raster operations do not draw in non-render modes.

Definitions and RenderMode execute immediately during list compilation;
name-stack and pass-through commands compile and replay using execution-time
state. Selection/feedback state is neither shared with list namespaces nor
copied by server attribute/context-copy operations. Context deletion frees it.

## Validation

Both locked full builds passed, including the final
`flock /tmp/wine-build.lock bash tools/build.sh`. Static checks covered manifest,
fragment balance, expression types, handler ABI shape, duplicate/raw-address
ratchets and JS syntax. The fresh boat received 5,842 exact committed input
blobs plus only the owned delta and two committed DOS build-gate bundles;
the final 5,847-file SHA verification had no mismatches. Foreign shared-tree
work was excluded.

`test-gl-selection-feedback.js` passed natively and through an actual queued
Worker: real static/dynamic lookup and stdcall stack/register canaries; clipped
line/triangle depth extrema and names; arrays/indexed draws; all five feedback
formats, interpolated colors, homogeneous W, texgen/texture matrix, lighting;
polygon boundaries/edge flags, raster tokens, pass-through, errors/overflow;
display lists, context isolation/sharing/copy, and restored ordinary rendering.
Software-disabled producer checks cover culling, full feedback attributes and
lighting. The Worker submitted exactly two ordinary draws with zero fallbacks;
non-render primitives stayed on the synchronous producer. A deliberate mutation
that suppressed selection hits failed the first two-hit assertion (`0 !== 2`).

Direct and Worker captures passed `test-gl-selection-feedback-web.js` in actual
WebGL 1.0 and 2.0 contexts, with zero GL errors. Pixel controls checked unchanged
framebuffers during both modes and the restored white triangle on black;
native and WebGL screenshots were retained and visually inspected.

All 21 relevant regression cases passed: evaluators (native/Worker/WebGL),
availability, lists, attrib stack, context copy (native/Worker/WebGL), edge flags
(native/Worker/WebGL), shared objects (native/WebGL), drawable color buffers,
drawable lifecycle (native/WebGL), DLT1 lighting, interleaved arrays, and period
server state (native/Worker).

First failures remain in the run: absent fresh-box dependencies (fixed by pinned
`npm ci --ignore-scripts`); an incomplete context-copy transaction in the initial
mode replay fixture (context checkpoint separated, native context assertions and
dedicated full WebGL context-copy regression retained); and the unchanged
context-copy WebGL test's missing historical output directory (own-boat symlink
into this run, original assertions unchanged). A mistaken static-check script
path was corrected to `tools/test-tiers.js --check`.

SHA-256 artifacts:

| Artifact | SHA-256 |
| --- | --- |
| Canonical `wine-assembly.wasm` | `06e51a8d06f0a09b1834659f0d0830e4b9317eb9a922e1756f083f7853f7ba94` |
| Compatibility `wine-assembly.compat.wasm` | `09cd66e34caa4290a573f1992984f57ccfcc697b786ad0b959ed4718740b9725` |
| Instrumented focused module | `d583ee9d1c252bd630b53b286c377ed9158fb534f5074cb60d8ace9c21211e47` |

Static work respected Alice's runtime ownership until her explicit release at
20:48:01Z. Own fresh TTL3600 boat `bx_p7v337jk` expires at
2026-11-03T21:52:28.558Z; ID/expiry/delegated shutdown owner were recorded before
use. Recovery requires both canonical and compatibility modules plus full SHA
verification before its delegated normal stop. Lifecycle receipts remain in the
ignored run. Root owns TODO/STATUS/corpus updates. Original MDK2 gameplay remains
**unqualified**; the availability test retains the historical 50-name inventory,
with this family eight of the prior 24 misses and 16 still unsupported. Actual
original-game inventory/gameplay validation is separate work.
