# MDK2 double matrix transforms — 2026-11-02

`glLoadMatrixd`, `glTranslated` and `glScaled` now have native implementations
and resolve through both the static OpenGL fallback and WGL lookup. Their
existing IDs 4323/4445/4401 and physical nargs 1/6/6 remain stable. The pointer
call consumes 8 bytes including the stdcall return; each three-double scalar
call consumes 28. No opcode was added. The other 178 names in the observed MDK2
miss set remain rejected; original MDK2 startup is not qualified by this work.

The [OpenGL 1.1 specification](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf)
§§2.6.3, 2.10.2 and 5.4 supplies the matrix, Begin/End and list contracts.
Matrices load column-major and replace the selected top. Translation/scaling
postmultiply. Pointed values are captured at issue time; list execution uses
the then-current selected matrix, with COMPILE deferring execution and
COMPILE_AND_EXECUTE applying it immediately as well.

Checked guest access reads sixteen doubles eight bytes apart, or three scalar
doubles at ESP+4/+12/+20, including across non-affine sparse pages. Values are
demoted with `f32.demote_f64` into invocation-owned affine storage. This
matches the existing float renderer and glMultMatrixd boundary; matrix storage
remains f32. The canonical encoder copies the converted values before the
allocation is freed. The guest source, argument bytes and non-result registers
stay intact. Missing/wrapped memory or allocation failure traps before EAX/ESP
cleanup or matrix mutation.

Canonical opcodes 34/41/40 retain load/translate/scale semantics. The shared
list layer now captures opcode 34's 64 pointed bytes exactly as opcode 109
already did. It rejects 34/40/41 during a live or compile-shadow Begin before
recording or observing the command, including on replay. This also repairs
these float commands' list capture and Begin rejection. Other unsupported list
commands retain their existing fail-fast behavior.

The focused test uses genuine GetProcAddress thunks and the Win32 dispatcher.
Its literal noncommuting A*T*S product does not use production multiplication
as an oracle. Actual 8×8 direct and queued software pixels are checked against
literal masks: D=diag(.5,.5,1,1), T(.5,-.5,0), S(.5,1,1) maps the unit quad to
clip [0,.5]×[-.75,.25], red columns 4..5 and rows 1..4 from bottom. A stronger
order fixture uses T(1,-.5,0): correct order gives clip x=[.25,.75], columns
5..6; reversed order gives x=[0,.5], columns 4..5. The smaller translation's
reversed order can quantize to the same pixel mask, so it is not used alone
as an order negative control.

Both routes pass 60 checks, including all four selected stacks, f32 tie-even,
subnormal/signed-zero/extreme conversion, stream and list pointer snapshots,
both list modes, mode at replay, pending vertex byte/count/mode preservation,
real caller triangle pixels after Begin errors, and register/stack integrity.
Each route also rejects wrong order, corrupted pixels and an empty expected
mask. Sparse fixtures exercise all three handlers across non-affine pages,
missing-page/allocation atomicity and eight stride/opcode/conversion mutations.
The retained original WAT rejects all three names after a canonical positive
control. Four full-source stride/opcode/scalar-stride/conversion mutations
fail assertions.

Stack overflow/underflow checks observe the native matrix error latch after
resolved pushes/pops and verify unchanged saved matrices. The current host
GetError path does not merge that diagnostic latch. Invalid MatrixMode enum
reporting is also an existing canonical limitation, outside this change.
Begin rejection is tested through actual resolved glGetError (0x502).

Validation commands and outcomes are retained in
`scratch/runs/20261102-gl-double-matrix-implementation/`. Heavy validation runs
on an exact hashed source snapshot in a temporary sandbox; editing and commits
remain in the single main checkout. Evidence includes direct/queued RGBA bytes,
observed matrices, old-source and mutation logs, focused regressions, locked
build, and input verification. The source archive has no Git history; the
append-only API check also ran locally against actual HEAD. Failed development
attempts are retained, including the missing list capture, extra canonical-error
assertions, subpixel order-control correction and a rejected-name test corrected
from already-supported glRotated to unsupported glMap1d.

No original MDK2, browser, download or public deployment ran for this task.

Final validation passed the existing matrix-stack, matrix-observer,
glMultMatrixd-dispatch, display-list, WAT-encoder, WGL-availability,
rectangle-family and command-stream regressions, followed by
`flock /tmp/wine-build.lock bash tools/build.sh`. The final snapshot verifies
7,186 input hashes. Snapshot packaging failures and the corrected scalar
epilogue static-check failure are retained alongside the successful run.
