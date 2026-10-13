# Proposed common rendering command contract

**Status: proposal, not an implemented renderer unification.** This document
records the current architecture and an incremental direction for moving API
semantics into WAT. It does not change the renderer, replace the current command
protocols, or claim additional game compatibility.

The intended boundary is: WAT interprets guest graphics APIs and produces an
explicit drawing contract; a software executor and a thin JS/WebGL executor
consume that contract. A generic shader-IR-to-GLSL compiler may remain in JS.
API-specific combiner, texture, coordinate and state interpretation should not
be independently implemented by each executor.

## What is shared today

Threaded browser processes already create one physical render Worker through
[`host.js`](../host.js), `_getRenderWorkerManager`, and
[`lib/render-worker.js`](../lib/render-worker.js). D3D, OpenGL and Glide open
virtual endpoints on that process-owned manager. They do not each create their
own physical worker in this mode. Endpoints may own separate devices, GPU
contexts and resource namespaces. The page remains responsible for window
composition and input.

[`lib/d3d-render-worker.js`](../lib/d3d-render-worker.js) dispatches those
endpoints to specialized adapters. Sharing this worker is not the same as
sharing all rendering semantics:

| Frontend | Current WebGL path | Current software path |
| --- | --- | --- |
| Legacy D3D, including D3D 5–7 | `d3dim-gpu.js` lowers onto the D3D9 fixed-function GPU backend | Native legacy span rasterizer |
| D3D 8/9 | `d3d9-backend.js`, with API-specific fixed-function lowering in JS | Native shader VM and quad rasterizer |
| OpenGL | `gl-compat.js` fixed-function frontend and generic GPU backend | WAT GL frontend uses the legacy span rasterizer |
| Glide 2/3 | `glide-backend.js` implements combiners and generates GLSL | `glide-software.js` generates native shader IR and uses the D3D9 software adapter |

D3D8's ABI layer already shares D3D9 state and execution; see
[`src/09ac-handlers-d3d8.wat`](../src/09ac-handlers-d3d8.wat).
Glide2/3 likewise share canonical rendering packets after their native ABI and
vertex-layout handling. Neither relationship implies complete API coverage.

Cooperative/browser and headless hosts can still use local execution. Older
explicitly nonshared worker configurations also remain in the code. A legacy
D3D WebGL primitive can decline to native software on the same render owner.
The proposed contract must work in these modes without requiring a Worker or
turning a startup failure into an unnoticed local fallback.

## Proposed ownership boundary

```text
Guest API calls
    |
WAT frontend: state, validation, formats, API-specific lowering
    |
Immutable draw/resource descriptors + native shader IR
    |
Ordered process render queue
    +-------------------------------+
    |                               |
WAT software executor         JS WebGL executor
shader VM + rasterizer        generic IR -> GLSL + WebGL calls
    |                               |
    +------ completed presentation --+
                    |
             page compositor
```

WAT should own:

- Guest ABI, handles/refcounts, defaults, state capture, validation and supported
  capability decisions.
- Vertex layout interpretation and API-specific coordinate conventions;
  fixed-function lighting, texgen, combiner equations and parameter liveness.
- Guest texture formats, palettes, pitches, origin conversion and mip-chain
  interpretation. Reuse existing native conversion routines where applicable.
- Semantic resource identity, aliasing, generations and invalidation, including
  the distinction between CPU-visible guest storage and GPU-resident contents.

JS should own:

- Queue transport, bounded admission, memory leases, GPU object maps and cleanup.
- WebGL allocation, uploads, state binding, drawing, queries and explicit copies.
- Generic native-IR-to-GLSL translation and driver capability adaptation.
- Delivery of completed presentation snapshots to the compositor.

A shader compiler is not automatically too much JS. Compiling a normalized
instruction such as multiply, texture sample or discard is backend work.
Interpreting `grColorCombine` or GL light state inside that compiler would
reintroduce the duplicated frontend semantics this proposal removes.

## Reuse the current contracts

The versioned neutral stream in
[`lib/d3d-command-stream.js`](../lib/d3d-command-stream.js) already defines
`RESOURCE_CREATE`, `RESOURCE_UPDATE`, `RESOURCE_RELEASE`, `BIND`, `DRAW`,
`CLEAR`, `COPY`, query begin/end, `READBACK`, `FENCE` and `PRESENT`. Retain its
ordering, generation checks, ownership and error propagation. Its current
payloads are JS data objects; a WAT-owned binary descriptor can initially be
projected into these objects by a read-only adapter. Binary transport and
batching changes need not be coupled to semantic migration.

Reuse the native shader IR in
[`src/09af-d3d-shader-ir.wat`](../src/09af-d3d-shader-ir.wat) and its read-only
projection, [`lib/d3d-shader-ir.js`](../lib/d3d-shader-ir.js). The production
D3D9 GPU path already accepts native IR through `compileNativeIR`, while the
software path uses the native shader VM. The native fixed-function compiler
in [`src/09aj-d3d-fixed.wat`](../src/09aj-d3d-fixed.wat) is another existing
building block; do not introduce a second frontend IR merely to rename it.

The current IR is not assumed to express every GL/Glide feature. Add narrowly
specified, versioned operations or pipeline fields for missing semantics,
with execution tests for both consumers. Do not silently approximate a feature
because it has no equivalent in the current D3D shader profile.

## Make implicit state explicit

A draw descriptor needs enough information that neither executor consults
mutable guest API state to decide what the draw means:

| Area | Required explicit information |
| --- | --- |
| Geometry | Topology, vertex/index ranges, attribute formats, interpolation qualifiers, vertex and fragment IR, immutable constants |
| Coordinates | Clip-space versus transformed coordinates, viewport/depth range, pixel-center convention, origin, front-face convention and clip policy |
| Textures | Resource ID/generation, subresource, canonical format, dimensions, initialized mip range, address/filter modes and LOD rules |
| Perspective | Independent coordinate/Q inputs per sampler, projection point and interpolation rule; preserve distinct Glide Q0/Q1 |
| Depth/stencil | Attachment identity, comparison/write state, Z versus W-depth mapping, bias and clear value semantics |
| Fragment operations | Alpha test, blend equations/factors, independent channel masks, chromakey source, fog mode/table and saturation order |
| Presentation | Front/back attachment identity, buffer exchange, drawable size and presentation-only gamma/LUT |

Resource creation/update descriptors must distinguish allocation from content
updates and preserve subresource aliases. Canonical texture data need not mean
uncompressed RGBA for every format: use a format with explicit semantics that
both consumers support, or perform a native conversion once. Backend-required
storage completion for partial mip chains must not change the supplied mip
range or allow sampling invented levels.

Glide W-depth/fog hooks and per-TMU projected sampling are examples of semantics
that cannot disappear during a mechanical conversion to ordinary D3D state.
Likewise GL clip conventions and D3D integer pixel centers must not share an
unqualified default. Encode these choices or lower them explicitly in WAT.

## Do not force CPU transforms or GPU readbacks

Moving semantics into WAT does not mean running every vertex transform on the
CPU. WAT can lower lighting, matrices and texgen into vertex IR; WebGL executes
that IR on the GPU and the software executor runs it in WAT. Preserve existing
CPU projection/clipping where an API requires it, but do not make transformed
vertices the only common input format.

Keep three boundaries separate:

1. **Consumed:** command storage or snapshot leases can be reused.
2. **Completed:** prior GPU/native execution has finished.
3. **Read back:** requested results have been materialized in guest memory.

A fence or `grFinish` can require completion without pixel readback. Present
should retain GPU-resident targets and transfer a presentation snapshot, rather
than reading pixels merely to fit a software-shaped interface. Guest locks,
read queries and mixed GDI/DirectDraw ownership transitions may require
readback; represent those transitions explicitly and retain existing dirty
region/lazy synchronization behavior.

## Incremental implementation

### First slice: one native fixed-function lowering path

Start with a bounded D3D9 fixed-function profile already handled by the native
compiler: transformed POSITIONT vertices, an established texture-stage
operation, ordinary depth/blend state and no new lighting/fog feature. Export a
stable description of the native compiled IR and constant bindings, then make
the GPU consumer compile that same IR instead of using the JS fixed-function
plan for this profile. Keep the neutral queue and resource machinery unchanged.

The acceptance artifact is identical native IR/constants consumed by software
and WebGL, with pixel and ordering regressions passing. Expand the profile
only after that boundary works. Temporary comparison paths belong in tests;
production must have one semantic source for each migrated profile.

### Next: Glide lowering and resources

Move the existing JS native-IR emitter in
[`lib/glide-software.js`](../lib/glide-software.js) into WAT. Share that lowering
with WebGL rather than maintaining separate GLSL combiner equations in
[`lib/glide-backend.js`](../lib/glide-backend.js). Migrate texture conversion,
state-dependent attribute liveness and normalized draw descriptors alongside
focused tests. Preserve two-TMU cascades, intermediate saturation, independent
Q, fog, W-depth, framebuffer masks, LFB ordering and display-only gamma.

This is not a promise that routing current Glide packets straight into the
D3D9 GPU backend already preserves all those features.

### Then: legacy D3D and OpenGL

Legacy D3D's existing D3D9 GPU reuse makes it a suitable next producer of the
same normalized descriptors. Migrate the remaining API-specific JS
interpretation while preserving execute-buffer and shared-DIB behavior.
OpenGL is the larger conversion: move its remaining JS fixed-function state,
matrix/light/texgen lowering into WAT. Reuse the current GL software rasterizer
until the common software consumer can match its clipping, interpolation and
coverage. A shared interface does not require replacing every proven raster
loop in the first change.

## Acceptance and limits

For each slice, use common expected results independent of either executor:
state snapshots, distinct Q0/Q1, perspective interpolation, combiner saturation,
texture formats/mips, depth/fog/origin, channel masks, gamma, aliased resources,
updates between draws, explicit completion and error paths. Exercise WebGL1,
WebGL2 and native software where supported. Preserve bounded queues and
shutdown/resource lifetime tests.

Compare actual output as well as command counts. Record GPU readback count,
bytes and cause; migration must not add readbacks to ordinary drawing or GPU
presentation. Performance comparisons require the same scene, inputs and
source/artifact versions, separate from diagnostic capture overhead.

The five existing Glide game cases are required regression targets, not an
assertion that all are fully correct today:

| Case | Required observation |
| --- | --- |
| NFS II SE demo | Real Glide race/road rendering, driving, texture/depth and line behavior; do not substitute the original software-only demo |
| NFS III demo | Native Glide cockpit/track/HUD and driving, with unchanged LFB behavior |
| Diablo II demo | Menu and world movement on both renderers, including its clear masks and gamma |
| Hitman demo | Original Glide renderer through loading and playable world; retain documented invalid-UV behavior and input limits |
| Hype demo | Full-size world geometry and actual movement; capture adjacent presentations so menu/world alternation cannot be hidden by counters or a selected screenshot |

See [Glide design](3dfx-glide-design.md), [Glide3 corpus](glide3-corpus.md),
[Hype notes](re-notes/hype.md) and [Hitman notes](re-notes/hitman-demo.md).
Hype's traced empty/UI and world swaps remain a known issue; renderer
unification must neither claim to fix it nor suppress swaps as a workaround.
Retain existing D3D and OpenGL conformance/game controls as well—the shared
contract cannot be accepted solely because the Glide examples render.
