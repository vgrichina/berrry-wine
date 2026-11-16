# GL primitive context and semantic parity repair, 2026-11-15

Status: exact remaining blocker recorded; code remains **uncommitted WIP**.
The first actual browser scenario reached `PERMANENT_UNKNOWN independent
watchdog startup` before any GL request, packet or frame. No retry or later
native/browser operation followed. The repair is not fully qualified or
published. Both predecessor releases were personally verified before shared
edits/execution. Evidence:
`scratch/runs/20261115-gl-primitive-context-semantic-parity-repair/`.

Unchanged shared and committed-HEAD runs at `17801754c` reproduce
`primitive: triangles smooth`: reference 524 bytes/two records, WAT
796 bytes/three records. Opcode 65545 is EDGE (29 floats per vertex), not an
indexed packed draw. The starting fixture never created/bound a context.

## Independent public API contract

[Rendering contexts](https://learn.microsoft.com/en-us/windows/win32/opengl/rendering-contexts)
requires a current rendering context for GL calls to have an effect.
[wglCreateContext](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wglcreatecontext)
and [wglMakeCurrent](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wglmakecurrent)
define context creation and binding; a failed bind leaves no current context.
Internal encoder fallback without a context cannot establish public rendering
correctness. Tests of that fallback must identify their private contract.

[glPolygonMode](https://learn.microsoft.com/en-us/windows/win32/opengl/glpolygonmode)
defaults both faces to GL_FILL. Public tests should observe that initialized
default through genuine context binding, without forcing polygon mode to fill.
[glShadeModel](https://learn.microsoft.com/en-us/windows/win32/opengl/glshademodel)
defaults to smooth shading. Flat polygons use their final specified vertex's
color, except a single GL_POLYGON uses its first. Connected and independent
primitives must preserve that distinction when lowered.

[glBegin](https://learn.microsoft.com/en-us/windows/win32/opengl/glbegin)
defines vertex connectivity and alternating triangle-strip winding.
[glEdgeFlag](https://learn.microsoft.com/en-us/windows/win32/opengl/gledgeflag)
defaults true and marks the outgoing edge at each vertex. Its value affects
independent triangles, quads and polygons; connected triangles and quads have
boundary edges regardless of the current flag. Edge flags affect polygon line
and point rasterization. Lowering must preserve logical boundaries and avoid
introducing visible diagonals.

[glPushAttrib](https://learn.microsoft.com/en-us/windows/win32/opengl/glpushattrib)
groups current color, normal, texture coordinates and edge flag under
GL_CURRENT_BIT. Polygon mode belongs to GL_POLYGON_BIT; shade model belongs to
GL_LIGHTING_BIT. Restoring one group must not overwrite another group's newer
state. Matrix stacks are distinct from current attributes.
[glGetFloatv](https://learn.microsoft.com/en-us/windows/win32/opengl/glgetfloatv)
documents identity initial modelview, projection and texture matrices, current
white RGBA, normal (0,0,1), and texture coordinates (0,0,0,1).
Native public queries and output canaries should corroborate those defaults.

[wglDeleteContext](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wgldeletecontext)
detaches a context current to the calling thread before successful deletion;
deleting a context current to another thread is an error. Failure must not
invent a successful lifecycle barrier or discard pending geometry.

Strict complete wire comparisons remain required for two encoders implementing
the same transport contract. Independently specified literal topology and
attributes must additionally validate both outputs; agreement alone is not an
API oracle. Public x86 native pixels passed on both module forms. Real browser Worker
pixel qualification remains blocked before rendering. No physical GPU, performance, original game, full compatibility suite,
FPS or audio qualification follows from this task.

## Preparation evidence

The corrected predecessor release
`aa5ae2f8035f9683e07cd924d0a1b280d2a8b194f4a69508964f5bde36084f7b`
was personally checked using its direct artifact index and authoritative wait
references: 837 reference checks (including repeated references), 155 sealed
actual-wait/both-EOF records, and 509 recorded PIDs/process groups absent.
Borrowed predecessor references were not recursively resolved into this run.
This does not replace the two current workers' required releases.

The independently authored primitive decoder and literal tables pass 239 authored-only
controls without importing shared production or reference code. The first
control run exposed incorrect packet-relative pointer construction in the
authored control; that failure is retained, and the corrected control explicitly
rebases payload pointers when joining records. Thirteen additional checks
validate nondegenerate counterclockwise literal polygon winding; 48 mutation
controls reject changes in every compact and edge vertex slot. No production
result follows.

The fixtures add 60 whole-wire and literal primitive cases (ten GL
modes, smooth/flat, default fill/line/point), independent edge decoding,
attribute-mask checks, and direct-versus-delayed Worker comparisons. Public
x86/default queries and native pixel/GDI checks passed; the extra physical
browser Worker scenarios remain unqualified. The existing 14-lease workload remains
unchanged in its default scenario. Their initial preparation used syntax checks only; final results must come from actual executions.

The browser fixture includes an independent physical deadline
Worker with a direct host port. Each producer operation waits for its prearm
acknowledgement and keeps a fixed three-second deadline. An authored-only Node
thread control exercised normal stop and deliberate deadline expiry, observing
terminal refusal of later requests and actual thread exits with both output
streams at EOF. This validates the new guard logic in isolation, not browser
execution or public GL parity. Browser UNKNOWN handling skips further native
retirement requests and physically stops fixture workers.

Current Sims activation release
`1cabc869cb1737af7556187a06ed51398b098848a6c2ac5e5828cd8e362b3970`
was personally verified against its authoritative artifact index and direct
closure: 3196 reference checks, 540 actual-wait/both-EOF records, and 555
recorded PIDs/process groups absent. Its genuine Automation registration and
long Worker wait limitations remain unqualified and outside this GL task. The
GTA2 release `b2d3dc8c3f6a87c269c1e2b21f7efa4e0528fde7c5e1ab8adf27a30ffa6cea7f`
was subsequently verified: 1888 direct reference checks, 247 actual-wait/both-EOF
records and 247 recorded PIDs/groups absent. Both locks were free.

[glFrontFace](https://learn.microsoft.com/en-us/windows/win32/opengl/glfrontface)
and [glCullFace](https://learn.microsoft.com/en-us/windows/win32/opengl/glcullface)
define counterclockwise front faces and selectable back-face elimination. The
prepared public native fixture explicitly enables that contract, expects the
CCW primitive pixels, and separately expects a reversed triangle to leave the
black background while preserving its literal clockwise wire geometry.

The sixty new literal primitive cases use nondefault binary32-exact alpha and
homogeneous W, in addition to all texture/normal fields. Added controls cover
all homogeneous compact/edge cases, alpha/W mutations, and positive projected
winding. A prepared public native W=2 triangle checks both an interior pixel
and an excluded pixel that ignoring W would incorrectly fill, along with
readback canaries, GDI pixels, and literal pre-division wire coordinates.

The predecessor seven-packet context regression deliberately renders internal
context-zero fallback points after a failed bind and deletion. Its unchanged
trace and literal attributes are retained as an explicitly labeled private
transport control, rather than a public rendering oracle. The new public
lifecycle case creates both contexts and draws only while bound; the public
x86 fixture independently checks no-current refusal and real current/DC state.

## Repairs and observed failures

Public primitive/state/array and packed pressure fixtures now create and bind
contexts, and destroy them through the lifecycle API. The mock allocator reuses
two handles; encoder reset does not erase all context-owned raster state, so
omitting deletion leaked line/point mode into later default-fill fixtures.
Projective coordinates now switch between two actually created contexts.
The independent reference models outgoing edge flags, logical boundary records,
provoking colors and attribute masks. Strict complete packet comparisons include
publication boundaries and separate lifecycle cleanup; packed pressure retains
its existing complete ordered-record comparison plus exact lifecycle prefixes.
The explicit native wire publication model accounts for completed calls that
publish an earlier prefix, including unknown deletion with no deletion record.

The six independent mask cases found a production defect: glPopAttrib restored
shade model even when GL_LIGHTING_BIT (0x40) was absent. The generic native state
restore now checks that bit. Before rebuilding, the old module
`fe6692088ba3034e8e77bc0fd01e972b954ac1a5470aa7d07998e02320af16d1`
independently returned smooth (7425) after public x86 push(0), set flat, pop;
flat (7424) was required. Its fixed-three-second public operation guard remained
clear and actually exited with both output streams at EOF. The new fixture
checks all six masks through public queries, literal vertices and pixels.

Subsequent full-suite failures were carried through: private null-context
deletion now expects refusal, and detachment resets private fallback attributes.
All 48 imported-key/fallback points have literal attribute checks. An old raw
regression reused a trapped Wasm instance and then stalled at the two-instance
isolation test: traps can retain that instance's process lock. The owned child
was stopped as a failing fixture, with its complete output and actual wait
retained; the collector, supervisor and watchdog all closed. Each intentional
trap now uses fresh isolated memory/instance, which is never reset or reused.
The subsequent whole encoder suite passed. This raw harness failure is distinct
from a public-operation PERMANENT_UNKNOWN; no public deadline was waived or
expired operation replayed.

Final validation records exact Git SHA, relevant binary diffs (including owned
new files) and pins before each phase. Earlier intermediate iterations lack
complete per-iteration source cuts; their source attribution remains incomplete
and they are not final qualification. No source tree or media archive was made.

## Terminal result and limits

| Actual run | Result |
| --- | --- |
| `baseline-shared`, `baseline-head` | Original 524/796 first failure reproduced unchanged |
| `encoder-all-v5` | Full shared raw encoder suite passed after trap-fixture isolation |
| `head-build` | Full `flock /tmp/wine-build.lock bash tools/build.sh` passed |
| `head-validation-0-v2` | Full encoder and actual delayed Node Worker suites passed; 60 literal cases and exact 280 packets per single/triple-pool run |
| `head-validation-1` | Lifecycle, shared Worker, producer publication, shared objects and edge flags passed |
| `head-validation-2` | Drawable resize/isolation, headless GL, public window and public x86 native context/primitive tests passed |
| `head-validation-3` | Four reference consumers and real Worker edge flags passed |
| `head-browser` | First default WebGL scenario stopped at independent watchdog startup, before rendering |

The normal/compatibility native tests each completed 664 public calls with a
fixed three-second independent guard, no PERMANENT_UNKNOWN, literal geometry,
36 pixel/state observations, readback canaries and GDI checks. The normal module
was `8676073dcd4ef6ab138163d72a6a941c66fc280ef427197eb36408077e73ce2a`;
the compatibility module was
`44c9f1eeb49cab8a0f69d8b876be98cbe48706ef7011a4ab2181aa4802f0640f`.
The measured provider was llvmpipe (LLVM 20.1.2, 256 bits), WebGL 1.0.
No physical GPU is claimed. Native WAT software edge-flag coverage also passed,
including the existing real Worker path.

The browser report records zero results, frames, batches, deliveries, responses,
steps and backend creations; `permanentUnknown: true`, `laterRequests: 0`.
The producer reported watchdog startup failure before WebAssembly instantiation
or its first GL call. There is no watchdog-ready receipt. Its exact cause is
**UNKNOWN**; authored Node guard controls did not establish browser startup.
Chrome physically exited (code 0, fixture host stop) with actual stdout and
stderr EOF. The supervisor, watchdog and monitored PID/process groups are absent.
No native retirement/rebind/replay/retry request followed UNKNOWN. NativeQuit was
not observed or claimed. No browser pixel, original 14-lease transcript, or
additional primitive scenario is qualified by this failed run. Those assertions
remain in the uncommitted candidate; none was removed or waived.

The required final shared-tree full build and complete shared native/browser
matrix were not run after this terminal failure. The HEAD build predates the
last Worker expectation correction, while its WAT source/module is the one
subsequently tested by the native fixtures. Thus there is no claim that both
final whole-owned builds passed, and no code commit is authorized by incomplete
validation. All code changes stay in the shared tree with exact final binary
patches/pins under `source-at-terminal-blocker/`. This note alone may be
published to make the blocker reviewable.

All tracked foreign runtime WIP was preserved byte for byte and unadopted.
Two other live owners continued editing their own new test files; those changes
are identified separately in `foreign-terminal-proof.json`. The provider was
recovered from 162 pinned actual-cache files using offline npm with scripts
disabled; its task-private reconstruction is removed only after closure and
hash verification. No box, worker agent, original game or public deployment was
created. Full 27/gameplay/FPS/audio remain open; the old Quake 3 cause is UNKNOWN.
No performance claim or V8/SpiderMonkey disassembly claim follows.

Next work must repair and independently qualify physical browser watchdog
startup, retain the fixed three-second deadline and zero-later-request rule,
then finish shared/HEAD whole-owned builds and the full native/browser matrix
before committing the retained code. Do not infer that a nested-Worker startup
cause has been proven or retry this terminal browser run.
