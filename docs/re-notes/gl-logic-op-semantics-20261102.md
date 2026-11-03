# GL bitmap boundary contract and pending glLogicOp semantics (2026-11-02)

`glLogicOp` remains unsupported. The later bounded bitmap investigation below
repairs demonstrated import/publication loss; it makes no logic-op or gameplay
claim. Earlier blocked execution is retained as historical evidence.

## Stored-width prerequisite and source-precision blocker

The subsequent run is `scratch/runs/20261102-gl-logic-op-stored-width-ordering/`.
It retains a bounded storage repair. It does **not** implement or advertise
`glLogicOp`; the sixteen-operation supported-route contract remains unpassed.
The source-precision collision below is a concrete architectural blocker for a
faithful downstream-only implementation.

### Actual stored-width measurements and repair

Actual Chrome 151 / ANGLE Intel UHD 620 / Mesa 23.2.1 WebGL1 and WebGL2 reported
8/8/8/8 attachment bits for RGB555 bitmap drawables on unchanged production
source. A packed float-color point with RGB `7/255` read `[7,7,7,255]` immediately,
then `[8,8,8,255]` after publication and reimport. Twelve threshold/extreme
controls distinguished private attachment values from canonical five-bit
storage. Two overlapping half-alpha white points over black read 128 then 192;
publication changed 192 to 189. These are ordinary float-source storage
observations, **not** integer-color conversion or logic-operation acceptance.

Separately allocated low-bit FBOs actually reported 5/5/5/1 and completed on
both WebGL versions. The repair selects that storage for canonical RGB555
bitmap masks, validates its actual precision, and preserves the format on
resize. A failed precision/allocation check frees the candidate and retains the
old drawable. RGBA8 remains the window/32-bit format. Other 16-bit mask layouts
retain their previous backing behavior; no new arbitrary-mask support is claimed.

The renderer transport now carries the canonical channel masks, rather than
assuming bpp alone identifies the format. The actual browser-worker bitmap
route also selects five-bit storage. The private A1 channel is opaque and
unexposed: GL alpha width queries return zero, alpha-only writes do not alter
it, and canonical DIB X bits remain independent preserved padding. Storage
publication no longer changes readback. The overlapping blend controls now
read 132 then 197, with 197 retained after publication, for separate commands
and repeated points in one packed batch. All sixteen color masks have literal
pixel controls; canonical high bits and non-pixel row padding are checked.

Accumulation RETURN required a matching packed 5/5/5/1 upload on WebGL1;
byte upload produced `INVALID_OPERATION`. WebGL2 accepted byte upload but
exposed private alpha zero. The repaired RETURN keeps private alpha opaque and
uses the low-bit upload type. The literal `[.25,.5,.75,0]` return reads
`[66,132,189,255]` on RGB555, with no GL error; RGBA8 remains
`[64,128,191,0]`. A second masked RETURN at `.0162` distinguishes direct
five-bit conversion (`[8,0,8,255]`) from an incorrect intermediate byte
rounding (`[0,0,0,255]`); RGBA8 returns `[4,0,4,0]`. Both direct and actual
browser-worker controls exercise this boundary. LOAD/ACCUM likewise reconstruct
the five-bit level before normalization; LOAD of level 2 scaled by `.252` then
RETURN gives `[8,8,8,255]`, rejecting byte-normalized `[0,0,0,255]`. This is storage behavior, not proof of the missing incoming
integer-color conversion rule.

### Information lost before any destination-dependent executor

[OpenGL 1.1 section 2.13.9](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf)
requires unsigned integer colors to preserve their specified most significant
bits when lighting is disabled and the vertex color was not clipped. A
production-handler fixture and real resolved native stdcall calls measured:

| Stored RGB width | Unsigned `glColor4ui` RGB inputs | Canonical float32 RGB, both inputs | Required stored source values |
| --- | --- | --- | --- |
| 5 | `0x07ffffff`, `0x08000000` | `0.03125` | 0, 1 |
| 8 | `0x7fffffff`, `0x80000000` | `0.5` | 127, 128 |

With lighting off, unmodified point colors, and dithering disabled, the native
RGB555 stores were `0x8421` for **both** first-row inputs (the high bit was
preexisting X padding); RGBA8 stores were `0xff808080` for **both** second-row
inputs. Both row orientations and direct execution were measured. The actual
queued-software run reproduced the collisions with eighteen GL submissions
and zero fallbacks. These observations exercise supported color/draw APIs;
`glLogicOp` lookup remained zero throughout. They are evidence of missing
precision, not successful logic-operation pixels.

`$gl_color_integer_component` in `src/09a8b-handlers-opengl.wat` demotes to f32,
and `$handle_glColor_integer` lowers to opcode 25 (`glColor4f`) before list
capture and vertex encoding. The packed vertex contains float32 colors. Thus
the two distinguishable unsigned inputs already have identical downstream
state and records. No choice of destination snapshot, byte XOR, or downstream
truth-table formula can reconstruct the missing source bit. For example,
five-bit XOR with destination 19 requires 19 and 18 for the first pair;
eight-bit XOR with destination 166 requires 217 and 38 for the second.

The next implementation step is to preserve the required integer source bits
or equivalent exact conversion metadata across current color, list capture,
attribute/context restore, vertex/array encoding and worker snapshots, until
stored-width source conversion has consumed them. Float current-color queries
can retain their defined float representation. This requires an explicit
transport/state design, rather than enabling a destination-only shader against
the existing float records. No unused partial truth-table implementation or
availability change is retained in this repair.

### Destination ordering measurements

A separate actual WebGL control implements the exact normalized form of
stored-width destination INVERT (`1-d`), using an unattached snapshot. It does
not invoke or implement the public GL logic-operation API. In both WebGL
versions, two overlapping points using one snapshot leave five-bit destination
19 at 12; this is wrong for two inversions, whether submitted in one draw or
two draws. Refreshing between primitives restores 19, and a third fresh
inversion gives 12. The eight-bit literals are 166, 89, 166 and 89 respectively.
Sampling the attached destination instead raises `INVALID_OPERATION` (1282)
on both versions. The stale-snapshot and attached-feedback alternatives are
rejected controls, not passing semantic routes.

Production `WebGLBackend.draw` still submits complete vertex/index ranges;
`createProgram` still duplicates a single fragment color into MRT front/back
outputs. An eventual executor must refresh after preceding overlapping work,
read each selected destination independently, and apply depth/stencil effects
once. That executor, the full sixteen truth tables, source conversion,
blend suppression/state, errors, lists and state restoration still need their
complete native/direct/actual queued/software/WebGL acceptance before lookup
availability changes. `DESIGN.md` retains independent literal five/eight-bit
all-operation tables; those tables alone are not runtime acceptance.

### Validation and bounded failures

Validation details and exact final identities are in this run's `result.json`,
`final.txt`, `RECOVERY.md` and final manifest. The retained storage changes have
actual direct WebGL1/2 and actual browser-worker controls, resolved native
bitmap regressions including actual queued software, focused regressions and
a locked full build. Intended negative controls include restored private
RGBA8 storage, private alpha queries, wrong RETURN upload/alpha and intermediate byte rounding, byte-normalized LOAD,
dropped queue
masks, and the preceding alpha/padding/publication mutations.

Two early local phases terminated fail-closed on a stale 1.5-second heartbeat;
no disk-floor breach was measured. Their logs remain failures, including one
interrupted retrieval after the remote browser had exited. A subsequent
foreground supervisor uses a five-second liveness lease and an independently
sampling child guard; both retain fsynced terminal minima and sampling gaps.
No detached background watcher is used. No claim retroactively fills idle or
preparation sampling gaps. Heavy operations run only on the recorded fresh,
finite-TTL boat, with bounded direct hashed source streams and no local archive,
original-game replay, fixture download or deployment.

The broad existing window-drawable test also reaches a failed-bind state
assertion (`bridge._current()` is undefined after failed bind); the same TypeError
occurs on unchanged source. Its actual worker route passes 26 checks, direct
accumulation passes 584/588 checks on WebGL1/2, and worker accumulation passes
525 checks on both sources. The failing broad direct test is retained separately
from passing storage controls. An initial precision fixture chose a noncolliding
low eight-bit boundary and failed its own collision assertion; the corrected
literal half-range pair above is preserved alongside that failure. Neither
failure is counted as a passing control. A reused scratch lease filename also
rejected a design-only oracle before invocation; the lease helper now waits
for its own token, and the final proof uses a fresh label. That failed phase
is preserved without treating the non-invoked oracle as a test pass. A later
remote lease read encountered an in-progress JSON write and terminated only
its own test. Remote lease writes now fsync and atomically replace the file;
the interrupted mutation remains a failed phase, and fresh labels cover the
final complete verification.

## Measured bitmap boundary and repair

Evidence: `scratch/runs/20261102-gl-bitmap-boundary-contract/` (gitignored).
The current ordered Oni CLI dependency and Brave causal-observer dependencies
completed before source ownership and execution. Actual Chrome 151 / ANGLE
Intel UHD 620 / Mesa 23.2.1 WebGL1 and WebGL2 ran the same 3×2 literal controls before and after
the repair, with non-pixel row padding set to `0x6d`.

On unchanged source, 32-bit BGRA words `0x3c283848`, `0xff283848`,
`0x0096aa55` imported as RGBA `[40,56,72,255]`, `[40,56,72,255]`,
`[150,170,85,255]`: exposed alpha 60 and 0 were lost. A read-only access followed
by publication, or a point with all color writes disabled, changed canonical
alpha bytes to 255. An alpha-only point produced attachment alpha 128 which
publication also replaced with 255. RGB and row padding were unchanged.
The unchanged-old faithful oracle exited 1 for these literal mismatches.

RGB555 words `0xa8c7` and `0x28c7` both imported as `[82,49,58,255]`.
Their high bit is unexposed padding, not alpha: resolved native queries report
RGB widths 5/5/5 and alpha width 0 (32-bit reports 8/8/8/8). Old publication
cleared the high bit even after read-only or zero-mask use. An alpha-only draw
also exposed private RGBA8 attachment alpha 128 despite that zero-alpha-bit
format. These are separate channel and storage contracts. No-access publication
left canonical bytes intact on old and repaired source.

The repair opts GL bitmap transfers into preserving 32-bit alpha and bits
outside the 16-bit RGB masks; ordinary GDI conversions retain their existing
opaque defaults. WebGL publication reads the drawable attachment directly,
flips its rows, and avoids the opaque presentation canvas. Bitmap transport
carries bpp to the renderer; RGB555 suppresses writes to private attachment
alpha. RGB565 has no unused high bit, verified by its red-bit control.

Literal unit and actual WebGL controls cover unchanged pixels, all-zero masks,
RGB-only and alpha-only writes, alpha-zero RGB, row orientation/padding, aligned
and unaligned storage, and fresh GDI writes after publication. Five mutation
controls independently fail for discarded import alpha, store alpha, unused
bits, opaque presentation readback, and exposed private RGB555 alpha. Resolved
native direct and actual queued software tests cover 16/32-bit DIBs in both row
orientations, stack/register preservation, masks, literal stores and queries;
the queued run recorded ten GL submissions with zero fallbacks. Worker bitmap
transport has a focused protocol test; this is not an actual queued WebGL test.
The native resolver test explicitly requires `glLogicOp` to remain unavailable.
Focused GDI surface, bitmap-target, frame-state, shared-render-worker and
software-producer regressions passed. Procedure availability passed with all
three intended lookup mutations rejected; the scratch preload only disables
fonts and records the unchanged compiled bytes. The locked full build passed.

The first guarded execution phase hit the disk floor at 1,996,500,992 bytes and
terminated its own native test (exit -15); it is not accepted as a passing test.
Evidence retains that breach and its cause is unknown. Execution resumed only
after free space recovered above the floor and a second watcher was started.
That watcher was absent at final audit without a terminal minimum record;
continuous floor coverage of the recovered phase cannot be certified. The
initial full build and availability test stopped for omitted font assets, not
semantic failures; their original errors remain in the run. No game fixture,
download, deployment or original-game replay was used.

At the boundary-repair handoff: implement the sixteen logic operations against stored component widths,
with explicit 5-bit source/destination quantization for RGB555 and independent
RGBA8 channels for 32-bit surfaces. At that handoff WebGL still used an RGBA8 backing attachment;
this boundary repair does not establish low-bit logic quantization, dithering,
overlapping primitive ordering, independent front/back destinations, or the
full state/error/list contracts. Use non-feedback destination snapshots and
literal destination-dependent oracles before changing availability. This run
does not establish a WebGL implementation impossibility.

## Earlier blocked semantics run

That earlier run made **no runtime, dispatch, transport, backend or test changes**.
Its evidence remains under `scratch/runs/20261102-gl-logic-op-semantics/`.

The ordered predecessor gates passed: Oni93804 terminal/result/final/exact
AUTHOR RELEASE and 70 final file hashes, then Brave99598 and 364 final file
hashes, with named and scoped helpers absent. Main was refreshed to
`d64373af1ea6a97df7845e250200bba240bd3b39`. Foreign and laptop WIP were preserved.

## Concrete execution blocker

The guarded direct source stream exited 1 when `/home` free space fell to
1,961,848,832 bytes; its exception cleanup observed 1,961,193,472 bytes. Both
violate the task's 2,000,000,000-byte floor. The initial source guard also reserved
4 MiB. Available space later recovered, but this run did not retry the transfer
or claim the floor held. The cause of that transient allocation is unproven.
`stream-source.log` preserves both exceptions; `execution-abort.json` records the
abort and `stream-inputs.json.gz` pins the intended files by size/SHA-256.
No local archive was created.

Own finite-TTL boat `bx_3a2fwcqj` had original expiry
`2026-11-02T23:58:05.494Z` (TTL 7200 seconds), recorded in `box.json` and on the
messageboard before remote use. The stream aborted before extraction. Remote
abort inventory and its verified retrieval, cleanup and explicit delegated
shutdown are recorded in the run. STOPPED was verified at
`2026-11-02T22:02:45.763Z`, with remote helpers absent before shutdown and local
poll/transfer helpers absent afterward. The partial source archive is not an accepted
build input. The initial inventory command failed on the `ps` header; the
corrected headerless inventory and original error are retained separately.

**Not run:** unchanged-old API failure control; native resolved API tests; any
of the sixteen destination-dependent pixel cases; actual queued software;
WebGL1/2; semantic mutation controls; focused regressions; full build. No module,
rendered pixels, backend-format proof or original-game observation was produced.

## Contract and implementation work still required

Primary references read:

- [OpenGL 1.3 specification](https://registry.khronos.org/OpenGL/specs/gl/glspec13.pdf),
  sections 4.1.7–4.1.9, 4.2.2–4.2.3 and color-buffer state.
- [OpenGL 2.0 specification](https://registry.khronos.org/OpenGL/specs/gl/glspec20.pdf),
  final color processing and dithering, including fixed-point conversion.
- [Khronos glLogicOp reference](https://github.com/KhronosGroup/OpenGL-Refpages/blob/main/gl2.1/glLogicOp.xml),
  all sixteen operations, errors and associated queries.
- [WebGL feedback-loop restrictions](https://registry.khronos.org/webgl/specs/latest/1.0/#6.26).

Color logic must operate independently on each selected destination's stored
component bits after source processing and quantization; write masks follow.
It overrides blending without changing requested BLEND state. INDEX_LOGIC_OP
is distinct and has no effect in RGBA contexts. Initial mode is COPY with both
enables disabled. Invalid operations and Begin/End misuse must preserve state.
Clear and accumulation RETURN bypass logic. Context, display-list, attribute and
queued-state ownership must remain correct.

Read-only inspection found native 16/32-bit stores in
`src/09ab-handlers-d3dim-core.wat`, native state/snapshot/bitmap paths under
`src/09a8*`, and production transport/frontends/backends in `lib/`. The shared
native final store must retain correct 565/555 packing and padding. WebGL needs
separate destination copies, with ordering for overlapping primitives and
independent front/back results; sampling the drawing attachment is invalid.

A specific unresolved format issue needs an actual driver test:
`WebGLBackend.createDrawable` currently creates RGBA/UNSIGNED_BYTE textures,
while a native bitmap context can target a 16-bit X1R5G5B5 DIB and report five
RGB bits. An eight-bit logic test cannot establish that bitmap contract.
Whether an actual low-bit attachment can faithfully support it on each WebGL
route is **unverified**, not a demonstrated backend impossibility.

Unexecuted helper, shader and resolved-native-harness drafts remain in the run;
they are preparation only. They must be reviewed and completed before use.
The public unsupported gate must stay intact until the full requested semantics
pass, including literal destination-dependent results, format/mask/error/state
and ordering controls, actual software queue with zero fallback, actual
WebGL1/2 routes, meaningful mutation failures and a locked full build.

## Recovery

Restore stable disk headroom above the required floor before fresh execution;
do not reuse the stopped boat or the incomplete transfer. In a fresh finite-TTL
boat, record its ID/expiry before use and stream exact hashed source without a
local archive. The retained `stream-source.py` and `remote.py` are recovery
recipes; adjust the newly recorded box, and inspect their input scope and disk
guards first. Complete the old-source control before implementation, then the
full semantic and regression work above. Retrieve/SHA-verify evidence before
any explicitly delegated own-boat shutdown. This note supplies no basis for
removing `glLogicOp` from the unsupported-API test.
