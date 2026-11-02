# MDK2 numeric texgen setters and indexed queries (2026-11-02)

`glTexGend`, `glTexGendv`, `glTexGeniv`, `glGetTexGendv`,
`glGetTexGenfv` and `glGetTexGeniv` use the existing native per-context,
per-active-texture-unit texgen state. Existing scalar integer/float and vector
float setters retain their native opcodes and state path. Their dispatch frames
now use guest-aware copies, including pointers split across sparse pages. The
vector command captures its pointer at opcode 85 (opcode 83 is the scalar integer
setter), so queued replay owns temporary converted values. No new host-side
state copy or replay opcode is needed.

The primary reference is [OpenGL 1.1](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf),
sections 2.10.4, 5.4, 6 and table 6.12. Modes have one element; object/eye
planes have four. Scalar setters only accept mode. Signed integer planes are
numeric coefficients. Double inputs narrow into the established floating point
state. Integer queries round to nearest and saturate at signed integer limits.
S/T/R/Q start in EYE_LINEAR, with both plane families respectively x, y, zero,
zero. SPHERE_MAP is restricted to S/T.

Object coefficients remain in object coordinates. Eye coefficients are multiplied
by the inverse modelview when the setter executes, using the existing pivoted
solver, including non-affine matrices. Queries return the stored transformed
coefficients. A display list owns input values and executes the eye transform
on every replay; queries run immediately during compilation and are never
recorded. Validation precedes capture/observers, and complete guest spans are
checked before reading or writing, including nonadjacent sparse pages.

The focused resolved-stdcall fixture performs 672 checks on each of
the direct and queued paths, including generated raster coordinates and bitmap
pixels. Saved old source fails export resolution on both paths; fifteen compiled
semantic mutations fail the corresponding independent oracle. Availability
removes exactly these six misses, from 95 to 89. Original MDK2 replay remains
gated on all mandatory exports being implemented.

Run evidence: `scratch/runs/20261102-gl-texgen-numeric-query-recover/` (ignored).
The 61-command suite passed, including texgen/raster-position/bitmap/list/query/
encoder/availability regressions, queued regressions, generated-file checks and
`flock /tmp/wine-build.lock bash tools/build.sh`. Evidence records source hashes,
literal results, negative-control failures and publication.
