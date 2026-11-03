# Stored-width glLogicOp implementation (2026-11-03)

This change continues the accepted integer-source preservation in `bd1a15a25`.
It implements all sixteen color logic operations on native software and WebGL1/2.
It does not establish historical27 completion or original-game progress.

Native final stores apply the operation independently against each selected
buffer, after source conversion, ordered dithering and RGB555/RGB565/RGBA8
quantization, then merge channel masks and preserve canonical padding. Logic
suppresses effective blending while retaining the requested blend state.
INDEX_LOGIC_OP remains distinct in RGBA contexts; Clear and accumulation RETURN
bypass logic. COPY is the default with both enables disabled. Validation,
Begin/End errors, display lists, context state, COLOR/CURRENT attributes and
actual software Worker snapshots retain their specified ownership.

WebGL uses actual RGB5_A1, RGB565 or RGBA8 attachments and rejects unavailable
precision. Separate unattached destination textures are refreshed before each
lowered primitive. FRONT_AND_BACK samples separate front/back destinations in
one fragment execution, so depth/stencil are evaluated once. This avoids
attachment feedback and preserves overlap order. Snapshot storage is budgeted
and released with its drawable. Existing public API identifiers and transport
opcodes are retained; `glLogicOp` appends transport opcode 180.

Bitmap raster colors retain exact integer source information before float
conversion. DrawPixels list capture retains signed/unsigned 32-bit color input
through execution-time pixel transfer and channel quantization. Implicit RGB
channels in single-component images remain exact zero before transfer scaling.

## Controls and evidence

The ignored run is `scratch/runs/20261103-gl-full-logic-operations/`. Its result,
final and RECOVERY files identify the tested source, retrieved modules, command
logs, lifecycle and ordered predecessor releases. Frozen literal pixel tables
are independent of the implementation; a separate bit-minterm audit checks them.

The native controls cover all sixteen operations in RGB555/RGB565/RGBA8, both
DIB orientations, points/bitmap/DrawPixels, integer collisions, transfer scaling,
dithering, masks/padding, state/errors/lists/contexts, overlapping primitives and
independent front/back results. Actual shared-memory Worker runs require zero
fallback and poison producer snapshots after admission to check ownership.
Real Chrome WebGL1/2 controls cover actual attachment precision, all operations,
integer boundaries, bitmap sources, masks/blend/state/dithering, overlapping
points/lines/triangles and independent buffers, including actual browser Workers.

Mutation controls cover COPY-only execution, stale/shared destination, attachment
feedback, missing dithering, active blending, eight-bit storage substitution,
integer-source erasure, native Worker mode loss and bitmap source loss. Old
unsupported native/Web routes fail before the implementation; a measured
DrawPixels source collision fails before its repair. Regression fixtures now
expect failed wglMakeCurrent to detach, then rebind the retained drawable, as
specified by Microsoft's wglMakeCurrent contract; production failed-bind behavior
is unchanged.
