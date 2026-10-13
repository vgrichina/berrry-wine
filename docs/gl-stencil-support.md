# OpenGL 1.1 stencil rendering

`glStencilMask`, `glStencilFunc`, `glStencilOp`, and `glClearStencil` use the
ordinary native encoder and append command opcodes 136–139. They operate on an
eight-bit stencil attachment in both the software and WebGL renderers. Mask
setters alone do not allocate a software attachment.

The implementation supports all eight comparison functions and the six core
OpenGL 1.1 operations: KEEP, ZERO, REPLACE, saturating INCR/DECR, and INVERT.
References clamp to 0–255. Comparison masks and write masks are independent;
clears honor the write mask and scissor without requiring STENCIL_TEST.
Software points, lines, triangles, and bitmap pixels share the fragment path:
alpha rejection precedes stencil, stencil rejection cannot write depth, and
depth rejection selects the depth-fail operation. A disabled depth test selects
the stencil pass operation.

The native display-list context owns stencil state and answers integer/float
queries and `glIsEnabled`. Validation runs before list capture. The existing
attribute stack saves stencil state for STENCIL_BUFFER_BIT and its enable for
ENABLE_BIT; unrelated groups leave stencil untouched. Context deletion/reset
releases its state with the existing context record.

The software drawable owns a lazily allocated byte buffer. Resizing/rebinding
the drawable fences queued work and releases this buffer. Allocation failure
reports OUT_OF_MEMORY and suppresses the affected draw instead of drawing
without stencil. Render-worker records copy the stencil state and attachment
identity into their 1088-byte snapshot, so subsequent guest setters do not
change queued draws. Shared D3DIM rendering uses the extra fragment operations
only while a GL draw explicitly installs stencil state.

WebGL contexts request a real stencil attachment and refuse creation if it is
unavailable. Resized GL targets use a depth/stencil attachment, and restore the
frontend's stencil settings after allocation.

Stencil-index `glReadPixels` is explicitly unimplemented and fails fast on both
paths; it cannot fall through to the existing color-read conversion. Separate
front/back stencil APIs and wrap-operation extensions are not advertised by
this OpenGL 1.1 implementation. Existing software depth precision is unchanged.

Focused coverage lives in `test/test-opengl-stencil.js` (native pixel/state,
allocation failure, resize/reset, and copied worker records) and
`test/test-opengl-stencil-web.js` (actual Chromium WebGL1 and WebGL2 frontend
pixels, alpha/depth interactions, attribute restoration, and resized
attachments). The native point test uses the existing software rasterizer's
integer coordinate convention; it is not a claim of general subpixel parity.

Validation on 2026-10-13 is preserved in run
`20261013T2005Z-gl-stencil`: the full build, both WebGL versions, and eleven
serialized native/frontend/D3DIM regression tests passed. The canonical wasm
SHA-256 is `69a571baee5268a204dc2e3a112c86ad57f00bdf22e261490194844f630bd2a3`.
The run records the exact dirty source patch and verified local/remote file
hashes. Initial dependency-link and test-coordinate/worker-retry setup failures
are retained alongside the passing logs. This is implementation validation,
not a Neverwinter Nights world-entry or gameplay result.
