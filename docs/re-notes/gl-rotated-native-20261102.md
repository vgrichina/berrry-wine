# Native glRotated, 2026-11-02

`glRotated` now has a checked native guest adapter for four GLdouble scalars
(32 argument bytes, 36-byte stdcall cleanup). It snapshots all four values
through guest-page translation before allocating invocation-owned affine
storage. Opcode 90 and its eight-word stream/list payload remain stable.
The API metadata describes physical stack words, as for Translated/Scaled.

The [OpenGL 1.1 specification, section 2.10.2](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf)
defines right-handed rotation in degrees around a normalized arbitrary axis,
postmultiplied onto the selected matrix stack. The
[Windows contract](https://learn.microsoft.com/en-us/windows/win32/opengl/glrotated)
specifies four WINAPI doubles and GL_INVALID_OPERATION inside Begin/End.
The 1.1 normalization formula leaves a zero-length axis undefined. This
implementation chooses to preserve the selected matrix without introducing
an error for that axis; Begin validation still rejects the call.

The earlier generic adapter translated ESP once and assumed the entire frame
was affine. Native normalization squared the original doubles, so finite
huge/tiny axes could overflow/underflow. Both native and host consumers now
scale by the largest absolute component before normalization. The host's
zero-axis cosine scale is removed. Both rotation spellings are rejected
before matrix/vertex observers inside Begin, including compilation-shadow
and replay states. Existing display-list nodes capture all 32 scalar bytes.

The focused test resolves the actual OpenGL module/export and executes its
returned guest thunk through Win32 dispatch. It covers non-affine adjacent
VM pages, stack/register canaries, atomic missing-page failure, retained
GLdouble precision, independent literal matrices, degree/sign/nonunit/huge/
tiny axes, modelview/projection/two texture stacks, push/pop, postmultiplication,
nested list capture after caller-stack reuse, and Begin preserving pending
vertices. Complete 8×8 RGBA checks exercise 45°, 60° oblique, 90°, and 180°
rotations, list timing, and noncommuting translation order. The 45°/60° inputs
are independent literal inverse-rotated vertices that land on a known
rectangle; this avoids dependence on the rasterizer's integer rounding of
arbitrary projected vertices. Initial ambiguous polygon pixel fixtures are
retained in the evidence as failed attempts.

Both real direct and queued routes pass 57 focused checks each. The original
four WAT files fail on both routes. Seven mutations (double stride, cleanup,
degrees, normalization, multiplication order, Begin validation, list capture)
fail through assertions. All 16 matrix/query/accumulation/list/encoder/availability regression variants,
two generated-file checks, and the locked build pass. Results are recorded in
`scratch/runs/20261102-mdk2-rotated-native-implementation/`.

Baseline ab45b7d43 already advertised glRotated through opcode 90. This repair
does not decrement MDK2's missing-export count. After the preceding
GetDoublev implementation the independently retained mandatory rejection set
contains **175** names; the real WGL and static-module rejection tests retain
all of them. No original MDK2 launch, replay, startup, or gameplay claim.

Heavy execution uses exact hashed source inputs on the finite-TTL boat
`bx_x9jk6ssr`, original expiry `2026-11-02T06:49:42.125Z`; source edits and
publication stay in the shared main checkout. All 49 evidence members were retrieved and SHA-256 verified before delegated
shutdown; STOPPED was confirmed at `2026-11-02T05:58:42.398Z`. All three remote runner
roots and their child process groups are absent. The local watcher terminated
with actual wait status 143 and was independently confirmed absent. Publication
and exact tested-code hashes are recorded with the run results.
