# glLogicOp semantics: execution blocked on 2026-11-02

`glLogicOp` remains unsupported. This run made **no runtime, dispatch, transport,
backend or test changes** and provides no semantic acceptance or MDK2 progress.
Only this note is published. Evidence is under
`scratch/runs/20261102-gl-logic-op-semantics/` (gitignored).

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
