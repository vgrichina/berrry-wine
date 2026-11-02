# MDK2 light and material queries — 2026-11-02

Implement `glGetLightfv`, `glGetLightiv`, `glGetMaterialfv`, and
`glGetMaterialiv` as native synchronous queries of the current context.
These functions bypass command recording and transport, including while a
display list compiles. Existing float and integer setters remain canonical.

Specification: [OpenGL 1.1](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf),
sections 2.13.2, 5.4 and 6, tables 2.8, 4.7 and 6.9. Lights accept LIGHT0–7;
materials accept FRONT or BACK, excluding FRONT_AND_BACK. Material
AMBIENT_AND_DIFFUSE is only a setter pname. Colors have four components;
positions four; directions and material color indexes three; other legal
properties one. Integer colors use signed normalized conversion; other values
round numerically. No legal queried property is an enum value. Stored eye-space
positions/directions are returned without applying the current matrix again.

Validate the complete stdcall frame and output span before writes. Sparse
page-aware stores preserve exact output width. Invalid enums and executed
Begin/End set GL errors without touching output; malformed memory traps before
writes or stack cleanup. A recorded Begin in COMPILE does not execute.

Validation: 58 commands passed, including the locked `tools/build.sh` build.
Dynamically resolved guest stdcall calls passed 461 checks per direct/queued
route, with 373 identical literal observations. Defaults, float/integer setters,
normalized colors, numeric rounding, modelview storage, scalar ranges, separate
faces/contexts, list compilation/playback, and sparse frame/output canaries pass.
Both saved-old-source routes and 13 compiled semantic mutations fail at the
intended assertions. The 38 regression invocations cover lighting, raster,
materials, lists, queries, encoder and availability; both generation checks pass.
Evidence: `scratch/runs/20261102-gl-light-material-query/`.
Exactly these four observed misses were removed, changing 99 to 95.
No original MDK2 replay is permitted until its full mandatory table is real.
