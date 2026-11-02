# GL bitmap boundary contract and pending glLogicOp semantics (2026-11-02)

`glLogicOp` remains unsupported. The later bounded bitmap investigation below
repairs demonstrated import/publication loss; it makes no logic-op or gameplay
claim. Earlier blocked execution is retained as historical evidence.

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
after free space recovered above the floor, with a new continuous guard. The
initial full build and availability test stopped for omitted font assets, not
semantic failures; their original errors remain in the run. No game fixture,
download, deployment or original-game replay was used.

Next: implement the sixteen logic operations against stored component widths,
with explicit 5-bit source/destination quantization for RGB555 and independent
RGBA8 channels for 32-bit surfaces. WebGL still uses an RGBA8 backing attachment;
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
