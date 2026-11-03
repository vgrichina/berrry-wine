# Cross-producer shared-texture upload visibility

Evidence: `scratch/runs/20261103-gl-shared-texture-visibility/`. Work began
after exact `gl-copy-context-ready-nov03 AUTHOR RELEASE` at 12:02:44 UTC,
published revision `8028df6ba03f1ec130cefdc0d8a2bc53ff4e946f`. The fresh
source seal uses main `9021ac57249daa73570bf22b84831c747a81718b`.
The complete context-copy contract and its fixtures remain unchanged.

The unchanged `test/test-wgl-shared-objects-web.js` reproduced the literal
cyan `[0,255,255,255]` expectation versus green `[0,255,0,255]` readback.
Both real WebGL versions failed that pixel comparison; native direct and
actual Worker software pixels already passed. The shared native image had
changed immediately, hiding the missing host upload from native pixel checks.

## Cause and repair

The generated dispatcher holds the process GL object lock around native
texture argument gathering and conversion. Its nested `gl_wat_encode_call`
returns at lock depth two. Publication formerly ran only inside that function
at depth one, so the completed upload stayed in the source producer's private
command stream when the outer handler released the lock.

`causal-order.json` traces the original immutable command bytes: the old
consumer's cyan checkpoint occurs at event96, but source opcode159 with
canonical float RGBA `[0,1,1,1]` reaches the bridge only at event100, during
a later source unbind. Browser instrumentation verifies the shared texture
identity/state and eventual cyan frontend update; the earlier consumer draw
still sees green. This is command publication ordering, rather than lost
pixel conversion or a separate WebGL texture namespace.

Publication now runs in `gl_object_leave` at the actual outermost completion,
before releasing the process lock. The same value-only CURRENT/raster
publishers and ordered stream drain are retained. Nested replay stays nested;
unfinished primitive snapshots, client state, stacks, resource identities and
namespace ownership retain the existing rules. No frontend/backend repair,
source rebind/query or fixture synchronization is needed. With the repair,
source opcode159 reaches the bridge at event217, before the consumer's
cyan checkpoint at event221.

The shared-object fixture now inspects the completed prefix immediately after
the mutation returns, without another source call. The new assertion fails
against the old module directly and with the actual Worker (empty prefix),
then passes with the repair. All original pixel expectations remain literal.
A separate later case holds an actual render-Worker batch while staging bytes
are overwritten and the still-current foreign source changes color/line width.
The full 3,252-byte lease stays immutable, SHA256
`e924a08d8589bafae592aadde9bb3c291ede26a16bfa2f38f14d55f7975ad69a`;
the Worker renders cyan with zero fallback. Optional browser output now saves
matching PNGs, frontend pixels and actual readbacks before asserting failures.

## Validation and identities

The locked full build passes. Canonical size remains 2,088,037 bytes:

| Module | Full SHA256 |
| --- | --- |
| Released baseline canonical | `7c22e2715377fd09a71887a62211ccd3cc0e8c96e56cbc65ca792e8c35213726` |
| Repaired canonical | `1f39572325be5251c4b9a923e83d4ea9ff33962d4d3e7911a4835df20cf0ae7e` |
| Repaired compatibility, 2,090,610 bytes | `06c2fbeee4051287305986fb8d18e8f6f3d27fda318cca48eceb8a0b6e0ebfd5` |
| Baseline shared diagnostic, 2,088,285 bytes | `be3a1ef79689df30841d5cab9f5e8e7f3efa3a4cd9df2eff8f30d674badf3b1e` |
| Repaired shared diagnostic, same size | `bd211c6a687b940c35a1d33898dd0f353191fe11507b94d1c5a136f36afe7f49` |
| Repaired public-copy diagnostic, 2,088,204 bytes | `1260e8e8ff9c0648803bafea2ba074da026a3f31d0b8fbad8a33a85a9460d777` |

Native sharing passes 20 direct and 21 delayed-Worker pixel cases; real
WebGL1/2 replay passes both transports. The complete copy suite retains
1,416 direct / 1,419 actual delayed-Worker checks on canonical and resolved
public stdcall routes, with real WebGL1/2 replay of all four captures. Its
selected/all masks, atomic failure/rollback, foreign-current source, unfinished
Begin, client/matrix/stack/resource/drawable isolation assertions are unchanged.
Hint, polygon/material, original faithful source-state and focused publication,
attribute, texture, drawable and Worker regressions are recorded in the run.

The baseline WebGL1/2 green captures and repaired WebGL1 direct / WebGL2 Worker
cyan captures were personally inspected: matching quads over black. The first
copy-browser invocation failed writing a missing hard-coded output directory;
its error is retained, the directory was created, and serial browser validation
resumed. This was an evidence-directory setup error, not a passing invocation.
Additional texture/browser checks needed explicit output-directory arguments
and the Linux Chrome path/flags; those setup failures are retained too.

The additional unchanged `test-shared-render-worker-web.js` fails identically
on the released baseline and repaired canonical modules: no first transferred
GL frame. Its manually constructed `wglMakeCurrent` record leaves `aux` at zero,
although its only drawable is window1; the production bridge consequently
rejects that target. This independent raw-record fixture failure is retained
and is not counted as passing shared-texture or context-copy coverage. The
production native command captures and actual delayed Worker checks above pass.

`RECOVERY.md`, full source/module/evidence manifests, exact commands and
old-fail/new-pass logs remain in the run. Own finite-TTL boat `bx_fqttx75u`
had original expiry `2026-11-03T14:07:23.315Z`, recorded before use;
shutdown owner is this worker. The original task delegates normal stop only
after verified full-SHA evidence/recovery retrieval and scoped helper absence.
Final publication and completed lifecycle are recorded in run sidecars.
