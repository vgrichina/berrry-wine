# wglCopyContext: complete native mask transaction

`wglCopyContext` now implements the selected/all-server-attribute transaction
through the native process lock and production consumers. The final section
records its qualification. Earlier sections retain the dated prerequisite
investigations and their then-unsupported public status.

Evidence is in `scratch/runs/20261103-gl-copy-context/`, including exact ordered
AUTHOR RELEASE lines, source/module seals, the native diagnostic, retrieved
full-SHA manifests, logs, result, and recovery instructions. Runtime began only
after Jedi92624's release at 05:20:45 UTC, then Alice82263's at 05:27:35 UTC.

## Contract

Microsoft documents selected server attribute groups using the same masks as
`glPushAttrib`, contexts in one process and OpenGL implementation, and a
destination that is not current on any thread. Identical pixel formats in the
same process must support copying. Failures return FALSE with extended error
information from `GetLastError`. Pixel pack/unpack, render mode, selection and
feedback state are excluded.

Sources: [wglCopyContext](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wglcopycontext)
and [glPushAttrib](https://learn.microsoft.com/en-us/windows/win32/opengl/glpushattrib).
`GL_TRANSFORM_BIT` covers matrix mode, clip equations/enables and normalization;
it does not copy matrix contents or stack depths. Attribute stack contents and
client-array descriptors must remain destination-owned.

## Measured first cause

The unchanged canonical module is 2,081,417 bytes, SHA256
`36a80f073b3bc4f59bb66d8c292684085c111be42cf999523723ff0cfab64788`,
from the source following `c1f211fdc027052994180ca52b0bff873715cd99`.
The post-release source/support seal was taken on
`f21b9fc2b664368532ce762f3e071a702822d8ca`. Subsequent coordinator changes were
documentation only. The compatibility module is 2,083,990 bytes, SHA256
`00cf4d02c0f7729d0b46a06cd24d7de50eec895fa080bc64ce1ea30db57fc10b`.

`publication-probe.cjs` uses two actual native WebAssembly instances over shared
process memory, the production GL encoder and production software host bridge.
It installs no replacement native exports and no candidate copy opcode.

| Observation | Actual result |
| --- | --- |
| Source saved red / line width 2, unbound, rebound, then changed to blue / width 7 | Native current-color query is blue; shared current snapshot is red and raster snapshot width is 2 |
| Source queues width and light-diffuse changes; other producer flushes | Source still has two pending commands; actual frontend light diffuse remains `[1,1,1,1]` |
| Other producer tries to bind the still-current source | Bind fails and detaches the caller; source snapshot remains red |
| Source explicitly flushes | Frontend diffuse becomes `[0.25,0.5,0.75,1]`; CURRENT/raster snapshots remain red / width 2 |
| Source draws and finishes | Actual native center pixel is `0xff0000ff` (blue); saved current color remains red |
| Source unbinds | Shared snapshots finally become blue / width 7 |

The current source may legitimately remain current on another thread; the
documented exclusion concerns the destination. A caller-local flush cannot
publish another native instance's pending stream or private globals. A copy
based on saved blocks would therefore lose state even when its shader consumer
has been flushed. Temporarily rebinding the source fails for this case and would
also interfere with context identity and drawable ownership.

The relevant native boundaries are `gl_wat_encode_call` / `gl_object_publish`
in `src/09a8c-gl-encoder.wat`, `gl_state_save` / `gl_state_context_changed` in
`src/09a8e-gl-state.wat`, and `gl_sw_context_save` in
`src/09a8g-gl-raster.wat`. Current snapshots mix server values with client
descriptors and attribute-stack pointers. Software snapshots also contain stack
frames and a live queued-draw phase cell. Texture blocks contain context-owned
default objects, binding pointers, namespace pointers and pixel-map storage.
Whole-block copying would corrupt ownership or alias later mutations.

Independent JS-only controls also demonstrate that the existing attribute-stack
implementation is not a valid copy oracle: `GL_LIGHTING_BIT` does not restore
light diffuse, while `GL_COLOR_BUFFER_BIT` wrongly restores material shininess.
The existing native attribute-stack test explicitly preserves matching
incompleteness. These controls diagnose prerequisites; they do not qualify any
new export.

## Repair plan from the initial investigation

First make server state observable at completed GL-call boundaries across native
producers. Under the existing process GL lock, publish current attributes and
raster values to context-owned, value-only state without moving contexts or
copying client/stack/resource pointers. Publish or safely drain each producer's
server-command prefix before a foreign producer reads that context. Merely
adding `glFlush` to the copy caller is insufficient, as the probe demonstrates.

The next acceptance test should require the above blue / width 7 / diffuse
values while the source remains current to producer 1, with producer 2 observing
the completed prefix. Add a subsequent independent mutation and delayed Worker
draw to prove that publication does not overwrite leased draw snapshots. Keep
the public copy export unsupported during this repair.

After that prerequisite passes, implement one explicit mask-selected operation
across native state and the JS/WebGL consumer, with destination-current,
process/implementation/pixel-format validation and transactional failure.
Cover every supported attribute group using independent expected values;
preserve matrix contents, client state, errors, object ownership and identities;
reject unsupported masks explicitly. Real WebGL1/2, actual render Workers,
native pixels, wrong-mask and aliasing controls are still required before
advertising `wglCopyContext`.

The initial investigation was a prerequisite investigation, not a copy API acceptance or a
gameplay result. No MDK2 replay, historical27 claim, public deployment, new
production routing, or source repair was performed.

## Validation and retrieval

The locked full build passed. Existing frame-state, mock WebGL drawable,
public procedure-availability (including three intended rejecting mutations),
and native shared-object regressions passed. The latter passed both directly
and with actual render Workers. These qualify the unchanged baseline, not copy
semantics. All 4,133 sealed source/support/module members still matched on the
boat after these checks. Locally, only the coordinator's concurrent `TODOS.md`
edit differed; production code remained identical.

The retrieved archive contains 57 members, 6,363,889 bytes, SHA256
`f89afa19cfa3e0c8f93949eb9f09f29d7785839d02921eae5a2f851d99f72fb7`.
Every manifest member's size and full SHA256 was verified after retrieval.
The artifact manifest's SHA256 is
`424f32e01ce42c5b63ea4ea4989729b8e18f65db45e5952aebe26230b9848d28`.
It includes the canonical modules and all captured diagnostic modules, whose
individual full hashes are in `retrieved/artifact-manifest.json`.

Owned boat `bx_tjdpmxmh`, original expiry `2026-11-03T06:01:12.516Z`, was
recorded before use with shutdown delegated to this worker by the original
task. It is verified STOPPED. Stop `stop_1b6524cb0aa9b2f6` completed at
`2026-11-03T05:38:50.092Z`, error null; scoped Node/browser helpers were absent
before stop. No box was retained or resumed.


## Completed server-publication prerequisite (2026-11-03)

Evidence: `scratch/runs/20261103-gl-publication-fixture-repair/`. Runtime and
production edits started after exact `jedi-authentic-launch-path-nov03` AUTHOR
RELEASE at 05:55:27 UTC, then `alice-single-trace-native-activation-nov03` at
06:14:46 UTC. The fresh shipped baseline matched the canonical hash above.

`gl_wat_encode_call` now publishes completed outer-call server values and drains
that producer's ordered command prefix before releasing the process GL lock.
Nested display-list replay publishes at outer completion; calls inside
`glBegin` publish at `glEnd`. The CURRENT and raster publishers write selected
values only. Client descriptors, UNPACK, saved attribute frames, resource and
namespace identities, and leased draw snapshots retain their existing owners.
Context-switch save/load still transfers the complete context-owned state.

The raster layout also needed one precise correction: the old 2,316-byte save
from live offset 1,792 to saved offset 1,844 placed the logic-op word at saved
4,156, which is the consumer-owned stipple phase. The context allocation grows
from 4,160 to 4,164 bytes; saved logic op now occupies 4,160. Save/load copies
2,312 bytes and transfers logic op separately, leaving phase 4,156 untouched.
The immutable draw-snapshot format is unchanged.

`test/test-gl-producer-state-publication.js` uses two actual native instances
over shared process memory. The unchanged expected-success assertions fail on
the old canonical module before a source query, and pass on the new module:
producer 1 keeps its current source while producer 2 sees blue CURRENT, line
width 7, diffuse `[0.25,0.5,0.75,1]`, and no pending source prefix. Independent
later changes, resource/client/stack identity checks, list compile/replay,
`glBegin` completion, native blue pixels, and a deliberately delayed actual
Worker draw verify ordering and isolation. Stale-state and reordered-prefix
controls fail the same assertions. The Worker uses the production command
encoder and actual render Worker, with zero fallbacks; its leased draw bytes
remain identical across later source mutations.

Actual WebGL1 and WebGL2 replay of both native captures produces the expected
blue pixel and ordered diffuse value. Focused frame, drawable (including actual
browser Worker), sharing (direct/actual Worker), attribute, stipple
(direct/Worker/fallback/WebGL), Worker transport, shared render-Worker and
public procedure-availability regressions pass. The client-attribute collector
was corrected to include the already supported EXACT_DRAW record alongside
PACKED_DRAW; its assertions pass against both old and new modules. The resize
mock now uses the real existing color-mask method while retaining its pixel-mask
and resize assertions. The browser
replay fixture converts typed arrays to arrays before value comparison.

The locked full build passes. Canonical output is 2,081,471 bytes, SHA256
`a6d0a4a80413d637ccacf6029bfb7058dcd39a8c819bfe2bed33101b2ba33b47`;
compatibility output is 2,084,044 bytes, SHA256
`73499240ea54a8b65536b8b1aaf171dec8d98e17c45f73c1d62512e08c253a34`.
Source seals, complete logs, retrieved modules, full-SHA manifests, rejecting
controls, lifecycle receipts and recovery recipes are retained in the run.

This completes the measured publication prerequisite only. No copy success
routing, source rebinding or saved-block copy was added. `wglCopyContext`
remains unavailable, as checked by the public availability regression and its
three rejecting mutations. Mask-selected copy semantics and validation remain
future work. This result makes no gameplay or historical27 claim.

## Mask-copy source-state prerequisite (2026-11-03)

The next investigation accepted published publication prerequisite `a08985c2b`
without repeating its audit. Evidence is in
`scratch/runs/20261103-gl-mask-selected-copy/`. Exact ordered AUTHOR RELEASEs
were Jedi startup readiness at 06:55:25.926114 UTC, then Alice original browser
gameplay at 07:13:36 UTC. Before those gates, work was confined to scratch:
`DESIGN.md` defines field whitelists and ownership for the mask groups,
`expected-success.cjs` prepares independent selected/unselected-value probes,
and `failure-cases.json` enumerates mask, handle, compatibility and destination
ownership cases. These are preparation, not passing copy coverage.

The fresh source seal is `0f8bef997f29ce931dbf66648fdc09286426c374`.
The sealed canonical module is 2,081,604 bytes, SHA256
`75379b0954be582cbeb9df8b40477c5e0b67292fa8833577ebcc7a8e798aaa80`.
A new faithful expected-success fixture, `state-fidelity.cjs`, fails before any
copy is attempted: required source server values are not represented.

| Legal source operation | Independent expected result | Actual result |
| --- | --- | --- |
| `glColorMaterial(GL_FRONT, GL_SPECULAR)` | Queries return `GL_FRONT` / `GL_SPECULAR` | Both output words retain sentinel `0xdeadbeef` |
| Front `GL_LINE`, back `GL_POINT` polygon modes | Two queried modes are `0x1b01`, `0x1b00` | Both output words retain the sentinel |
| Draw a blue triangle with both faces in `GL_LINE` over black | Interior pixel stays black | Native interior is blue, `0xff0000ff` |
| Replay the actual native command captures through production WebGL1 and WebGL2 bridges | Interior stays black | Both read `[0,0,255,255]`, GL error zero |

These expectations follow the documented
[polygon-mode](https://learn.microsoft.com/en-us/windows/win32/opengl/glpolygonmode)
and [color-material](https://learn.microsoft.com/en-us/windows/win32/opengl/glcolormaterial)
contracts. The missing values belong to `GL_POLYGON_BIT` and `GL_LIGHTING_BIT`.
The production frontend currently ignores both setters; the native state/query
and polygon rasterization paths also lack these semantics. The independent
pixel oracle distinguishes this from a getter-only omission. The fixture also
records an untouched hint-query output, but hints may be ignored; that observation
is not used as the prerequisite's decisive failure.

Two actual native WebAssembly producers share process memory. Producer 1 keeps
its source current; producer 2 initializes and unbinds an independent destination.
The source completed-command prefix is empty before the foreign observation,
with no source rebind or query used to publish it. The same source-state
assertions fail directly and with an actual deliberately delayed render Worker
using production command transport. The Worker reports one replayed native
triangle, zero fallbacks, and an immutable 2,996-byte leased snapshot, SHA256
`72a77ca7f68c49ffc5c8ced3270f6892d21f459709280e2edf035693b9e98b8f`,
across later source color and line-width mutations. The WebGL checks replay the
captured native draw bytes through the actual version-1 and version-2 backends;
both PNGs and readbacks are retained.

This is a new source-state prerequisite, not a failure of the published
cross-producer publication repair. Faithful copying cannot transfer polygon
modes or color-material selectors that the source never retained. The next
implementation must represent, validate, query and consume those server values
across native/software/WebGL and immutable Worker snapshots before completing
mask-selected copy. It must then execute the prepared mask and failure cases,
including subsequent destination/source isolation, client state, stacks,
resource identities and drawable-storage preservation. No whole-block copy,
partial-mask success, public routing, production repair or copy implementation
was added in this investigation. All-mask, combined/zero/invalid-mask,
invalid/deleted/incompatible-context and destination-current copy behavior
remain unqualified. There is no historical27 or gameplay result.

The locked full build passes and reproduces the sealed canonical module.
Twelve focused invocations pass: frame state, mock WebGL drawables, native
sharing directly and with an actual Worker, server/client attribute stacks,
native double-state queries directly and with an actual Worker, texture-state
queries, public procedure availability, shared render Worker, and browser
drawables. The existing `test/test-wgl-shared-objects-web.js` fails: its
separate-native-producer shared-texture mutation expects cyan but reads green
in WebGL1. This separate unchanged-source regression is preserved in full;
the focused set is not all green. No public-copy acceptance is claimed.
The first build attempt stopped because staging omitted two browser bundles;
generating them from the sealed inputs reproduced both local full hashes, then
the complete locked build passed. All 5,868 sealed non-scratch members still
matched after testing.

The retrieved archive is 2,028,957 bytes, SHA256
`5cb38968c9a46040afac66c5d24a8f2ce5daaa13d6c7a8721ff3fe45b01d5b0c`.
All 55 manifest members were verified by full SHA256 after retrieval; the
manifest hash is
`c99ad47da3853ebf71de3ea81d17030da026a7ecef717a7e8e6ef0a67e3bcd7f`.
The run retains fixtures, captured commands, native/Worker results, WebGL
readbacks and PNGs, modules, logs, seals, `RECOVERY.md` and lifecycle receipts.
Own boat `bx_35jx7b27`, original expiry 07:55:01.799 UTC, was recorded before
use and normally stopped only after verified retrieval and recovery instructions,
under the original task's explicit delegation. Stop `stop_1987e91b91cdc56d`
completed at 07:28:37.304 UTC, error null, forced false; final state is STOPPED
with a verified retained snapshot. Scoped test/browser/build helpers were absent.


## Period polygon and color-material prerequisites (2026-11-03)

The implementation following findings-only `c4bc527b0` now represents independent
front/back POINT, LINE and FILL polygon modes and the color-material face,
parameter and enable state in native context state. Native typed queries and
public material getters observe the retained values. Invalid enums and illegal
Begin/list operations preserve state; list execution and masked server attrib
restore use the same state. Lighting restores both materials, light parameters
and model selectors without restoring unrelated client, texture or fog state.

Polygon facing and culling precede mode selection. Native and WebGL rendering
lower points and clipped outside boundaries without quad/fan diagonals; split
logical polygons preserve line-stipple phase. Color material changes the selected
ambient, diffuse, specular, emission or ambient-and-diffuse fields for the selected
faces, including per-vertex lighting and retained values after disable. Immutable
render Worker snapshots carry the extra state; the stream publishes value-only
color updates that vertex packing previously absorbed.

Evidence is under `scratch/runs/20261103-gl-polygon-color-material-repair/`;
`RECOVERY.md` records exact seals, commands and lifecycle. The new independent
fixture covers the legal face/mode/parameter matrices, unchanged-state errors,
front/back winding, culling, clipped wireframe/points, lighting, masked attribs,
context publication and actual delayed immutable Worker leases. Browser fixtures
replay those native command captures on real WebGL1 and WebGL2. The predecessor
faithful expectations remain unchanged. Public `wglCopyContext` is still
unsupported: complete mask transactions and copy-specific failure/isolation
qualification remain separate work. These fixtures establish no copy success,
historical27 or gameplay result. The existing shared-object WebGL cyan-versus-green
failure remains visible and its assertion is unchanged.

## Hint server-state prerequisite (2026-11-03)

The next fresh baseline reproduced the published polygon/color-material module
exactly: 2,083,613 bytes, SHA256
`215edf1a09894f4b4d4e9d0e89dce47cf66a42597d084ec218772ec46364a293`.
The unchanged faithful fixture then failed only its independently expected
`GL_PERSPECTIVE_CORRECTION_HINT = GL_NICEST` query: the output retained
`0xdeadbeef`. Although rendering-quality hints are advisory, their selected
server values must still be retained, queried and restored by `GL_HINT_BIT`.

Five context-owned native hint values now default to `GL_DONT_CARE`. Legal
setters, all four typed getters, display-list execution and masked/nested server
attrib restoration retain those values. Invalid enums and Begin/End calls are
rejected before list capture. The production frontend implements the same
values and mask semantics. Existing command transport carries the setters;
no raster-quality switch, copy routing or unrelated operation stub was added.
The shared value-only context tail is observable by a different producer while
the source remains current, without querying, flushing or rebinding the source.

Evidence is under `scratch/runs/20261103-gl-copy-context-transaction/`.
`test/test-gl-hint-state.js` passes 170 direct and 171 actual Worker checks,
including exact getter widths, errors, lists, client/server masks, independent
contexts, retirement, native pixels and a deliberately delayed immutable
3,012-byte Worker lease. Actual WebGL1 and WebGL2 replay both native captures
and verify public hint queries and blue pixels. This completes a source-state
prerequisite only. Complete mask selection, atomic copy failure and copy-specific
resource/client/matrix/stack/drawable isolation remain unimplemented and
unqualified; public `wglCopyContext` remains unsupported. No gameplay or
historical27 result is claimed.

The locked full build passes. Canonical output is 2,083,916 bytes, SHA256
`446294d1ad655acc46eb5fc3684b91580b800961c75b4343b0b60993c353646a`;
compatibility output is 2,086,489 bytes, SHA256
`0a0e9af47bac2433bf259118235d3622e62cec183c0218e382cf363aa8b7a898`.
The unchanged predecessor faithful fixture now passes directly, with an actual
Worker, and through its original WebGL1/2 fixture. Polygon/color-material
direct/Worker native and real WebGL regressions pass. Of 23 focused invocations,
22 pass; the existing shared-texture WebGL1 case still reads green
`[0,255,0,255]` where it independently expects cyan `[0,255,255,255]`.
Its assertion and both predecessor fixture hashes remain unchanged. Procedure
availability still rejects copy and its three deliberately broken controls.
The run retains fresh baseline old-fail logs, tested sources, exact modules,
native captures, full delayed lease bytes, browser PNGs, full-SHA manifests and
recovery/lifecycle records.


## Complete native transaction (2026-11-03)

Evidence and recovery: `scratch/runs/20261103-gl-copy-context-ready/`.
The retained preparation candidate was revalidated against sealed current-main
source, then completed. Public lookup stayed unavailable during private native
and real WebGL qualification; both WGL and static OpenGL lookup now resolve the
actual native handler, with the ordinary three-argument stdcall ABI.

The implementation selects explicit server values for all twenty GL1.1 mask
bits and their enable overlaps. Zero and `GL_ALL_ATTRIB_BITS` are covered.
It validates both live context identities, implementation/device family,
destination ownership on every producer, mask bits and texture target conflicts
before commit. Invalid handles return error6, current destinations error170,
and unsupported masks error87 without changing destination value blocks.
Prepare stages native texture nodes and frontend maps; an injected second
allocation failure frees the first staged object, clears the plan, leaves the
namespace/bindings unchanged and permits a clean retry.

A source on another native producer remains current while the caller and
destination are unbound. No source bind, query or caller-induced source flush
repairs publication. Completed legal setters inside `glBegin` use a separate
value snapshot for copy reads; the existing committed primitive snapshot stays
unchanged until `glEnd`. The unchanged publication regression and the new
foreign-copy-inside-Begin test both pass. Client descriptors, pack/unpack,
client/server attribute frames, all matrix contents and stacks, GL errors,
resource/image/list identities, distinct drawables and current bindings stay
owned by their original contexts. Same texture names resolve in the destination
namespace; images are retained and only selected bindings/samplers change.
Deferred backend activation and sampler application occur on ordinary use.

The locked build passes. Canonical output is 2,088,037 bytes, SHA256
`7c22e2715377fd09a71887a62211ccd3cc0e8c96e56cbc65ca792e8c35213726`;
compatibility output is 2,090,610 bytes, SHA256
`94bf1e6eb547feda51bfdb79d3a6576b138919ae5779bb6746fe948b8a45eafe`.
The resolved-ABI diagnostic module is 2,088,204 bytes, SHA256
`f0cd4d89ced13770fec17a2de3d62c4353d836d50fdd39dca4569600368d4474`.
Direct and actual delayed Worker transactions pass 1,416 and 1,419 checks each,
on canonical and public-thunk paths. Worker consumption renders five triangles
with zero fallbacks; the full delayed 3,024-byte payload remains immutable,
SHA256 `10a7740e827c0758301325036db4c3398238c03ea87a5f69f77f52e5eb70827a`.

Real WebGL1 and WebGL2 consume all four native captures and independently check
blue/green/black copy pixels, destination red texture ownership, copied depth
write and polygon slope bias, and green copied material while the foreign
source primitive remains unfinished. The first units-only depth probe exposed
native16-bit versus WebGL24-bit depth precision; its failed literal blue-pixel
expectation and captures remain retained. The final common threshold uses slope
bias, keeping the same literal blue/green expectations; the units term is
[implementation dependent](https://wikis.khronos.org/opengl/GLAPI/glPolygonOffset).
Selected-mask queries still require the exact factor2/units4096 values.

All nineteen focused non-browser regressions pass. Hint170/171 and polygon/
material native direct/Worker and real WebGL1/2 tests pass without changing
literal expectations. Both original faithful state fixtures remain unchanged
and pass, including their original browser fixture. Four focused browser
regressions pass. The existing shared-texture WebGL1 assertion still fails:
expected cyan `[0,255,255,255]`, actual green `[0,255,0,255]`. Its assertion and
exact diagnostic module are retained; it is not counted as a pass. This change
does not repair that separate shared-texture visibility defect or claim
historical27, gameplay, MDK2 playability or public deployment.
