# OpenGL 1.1 user clip planes (2026-11-02)

MDK2 requires `glClipPlane` and `glGetClipPlane`. Six context-local planes
retain binary64 eye-coordinate equations, calculated from the supplied
object-coordinate equation by the inverse modelview at setter execution.
`GL_MAX_CLIP_PLANES` returns six. Defaults are zero equations and disabled
planes. `GL_TRANSFORM_BIT` restores equations and enables; `GL_ENABLE_BIT`
restores enables. Lists own the original 32-byte input and transform it on
execution; queries execute immediately during compilation.

Enabled planes intersect the existing view volume. Native points, lines,
triangles, strips, fans, quads, rectangles, arrays and listed geometry use the
shared clipper; raster positions are also rejected. Clip records interpolate
six signed distances with the existing colors, texture coordinates and fog
attributes. The enlarged polygon buffers preserve the normal matrix. Queued
software draws own a clipping-state snapshot. WebGL interpolates six signed
eye distances from the original vertices and rejects outside fragments;
this preserves lighting and generated texture attributes at cut boundaries,
including constant point-center tests across wide footprints. The JavaScript
software route clips packed primitives. Plane changes flush pending geometry;
bitmaps retain raster-position clipping.

Both exports use the two-word guest stdcall ABI and exact four-double
input/output spans, with whole-frame and sparse-span validation before
mutation. Invalid indices and Begin/End calls produce GL errors without
capturing commands or touching output. Singular modelview equations retain
the previous value, within GL's undefined singular-matrix case.

Primary specification: [OpenGL 1.1, sections 2.11, 2.12 and state tables](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf).

Evidence and validation are recorded in
`scratch/runs/20261102-gl-user-clip-planes/`. No original MDK2 replay was run;
mandatory unsupported exports still gate that lane.

Validation: direct and independent queued guest calls each pass 154 checks
with 98 matching observations; WebGL 1/2 pass 40 literal pixel checks. Saved
old source fails both routes, and nine compiled semantic mutations fail their
intended assertions. All 62 validation commands pass, including existing GL
regressions, generated ABI/dispatch checks and locked `tools/build.sh`.
Availability removes exactly these two misses, from 84 to 82.
