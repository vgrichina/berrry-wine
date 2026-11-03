# wglCopyContext: native publication prerequisite

`wglCopyContext` remains unsupported. The completed publication repair is recorded
in the final section below; the initial investigation did not implement or
advertise it. The first measured dependency is publication of a current source
context's producer-private state and pending server commands. Copying existing
saved context blocks, replaying the destination's attribute stack, or sharing
object namespaces would not satisfy the contract.

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
