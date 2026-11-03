# OpenGL edge flags — 2026-11-03

Input: `0d92be156557e0c3282ec24562681d8a39f9b395`. This change implements
`glEdgeFlag`, `glEdgeFlagv` and `glEdgeFlagPointer`; it establishes API-family
coverage, not original-game execution or historical27 completion.

The primary contract is the [OpenGL 1.1 specification](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf),
sections 2.6.2, 2.8, 2.11, 3.5.4 and 5.4. Current edge state initially is TRUE.
Scalar GLboolean arguments use their low byte; scalar and vector nonzero values
normalize to TRUE. A vertex carries its outgoing-edge flag. User flags affect
independent triangles, quads and polygons; strips and fans keep their specified
boundary behavior. Clipping preserves surviving original flags and introduces
TRUE edges. Polygon POINT selects vertices with outgoing boundary edges;
polygon LINE selects boundary segments after clipping and culling.

The native producer captures flags per vertex and emits intact logical polygons
for boundary rendering. The private append-only transport record `0x10009`
contains exact-color vertices plus an outgoing boolean. This avoids diagonals
from triangulating quads and polygons before clipping. Ordinary FILL records and
independent lines/points retain their existing formats. Native software and the
actual render Worker use the same polygon clip/raster functions. WebGL1/2 consume
the immutable value records through the fixed-function bridge. Malformed new
records fail explicitly. A single polygon exceeding the 2 MiB transport capacity
returns GL_OUT_OF_MEMORY instead of splitting connectivity or publishing a prefix.

Edge-array enable, single-byte pointer, packed stride zero, explicit strides and
indexed addressing are native client state. ArrayElement updates the edge flag
before emitting a vertex. Context switches and CLIENT_VERTEX_ARRAY_BIT restore
the descriptor and enable state; CURRENT_BIT restores the current flag.
wglCopyContext copies current edge state only under CURRENT_BIT. Display lists
capture scalar/vector values and expanded array elements; pointer setup executes
immediately during compilation and does not replay. Tests avoid assuming a
particular current edge flag after enabled-array DrawArrays/DrawElements.

The resolver inventory retains all unrelated unsupported names. The original
50-name MDK2 assertion now counts 47 still unsupported names and these three
implemented names; both resolver paths are checked. Existing regression test
files and assertions remain intact apart from moving these names into the
supported inventory.

Evidence and recovery: `scratch/runs/20261103-gl-edge-flag/` (ignored). Runtime
source is exact input Git blobs plus the explicit owned changes, verified by
SHA-256 seals. No foreign WIP is transferred. The isolated finite-TTL boat is
`bx_ued752bq`, original expiry `2026-11-03T16:46:45.683Z`; this worker owns the
explicitly delegated normal shutdown after evidence recovery. All heavy builds
and tests run there; browser tests run serially. Rebuild with npm ci --omit=optional,
then `flock /tmp/wine-build.lock bash tools/build.sh` at the published revision.

Validation: the locked canonical build passed. The new suite executes actual
static and dynamic opengl32 thunks with stack/register canaries, and checks
current defaults/normalization, validation, client/server stacks, context copy,
list value ownership, indexed and strided arrays, and immutable queued values.
Native software and the actual Worker passed 22 pixel cases plus setup; the
Worker replayed 24 draws with zero fallback. Actual WebGL1 and WebGL2 passed the
same 22 cases with GL error zero. Pixel controls cover mixed outgoing flags,
LINE and POINT clipping, user planes, clipped culling, collinear leading polygon
vertices, quad/polygon seams, arrays and lists, and independent/fill primitives.
The LINE depth-clipping fixture keeps the generated boundary inside the screen:
a line lying exactly on a side clip plane can have zero WebGL fragment coverage.
Native PNGs and the replay bytes are retained in the evidence directory.

All five requested regression scripts pass, including stipple's actual Worker,
fenced fallback and WebGL1/2 variants. Additional server-state, context-copy and
interleaved-array checks run on native software, Worker and WebGL. The
interleaved regression's record observer now accepts both existing packed ABIs
(float and exact-color); every original descriptor, geometry and pixel assertion
is retained. Its 14 formats produce 84 cases per native/Worker run and 504 browser
pixel cases. The context-copy browser regression consumes an explicit native
capture and uses an isolated boat-only symlink to keep its hard-coded evidence
location inside this task's run directory.

Final native/Worker harness module: SHA-256
`a63a0181b7d855a83ea64511416667c100c1d0f4c882a3ecd35ebd825322b239`
(2,089,874 bytes). Both routes log this same module identity; the binary is
recovered with the evidence. A mutation forcing every captured edge TRUE fails
the FALSE-edge pixel assertion (3 lit pixels versus 0), confirming the test
rejects dropped edge propagation. The final source seal verifies 5,829 inputs
against the pinned baseline plus explicit owned changes.
