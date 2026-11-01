# Software GL projective vertex and texture sweep, 2026-11-01

Both unchanged fixtures passed all original assertions on local native Node:
`test/test-gl-projective-vertex.js` and `test/test-gl-texcoord4.js`, sequentially
under `timeout --signal=TERM --kill-after=5s 120s`. No assertion failure,
native crash, or WAT trap occurred. Evidence: ignored
`scratch/runs/20261101-gl-software-projective/`.

The initial scratch-only queue ended at 08:44:50 UTC after Populous worker
`01a19637-6851-7332-a75f-552d02cd8846` had fresh final/result files and its
08:43:51 explicit runtime/source/build release. Actual main was pinned at
`922056d36f84dd5eddea8f8c28673fc797328b2d` (dispatch was `f62e481bc`).
The accepted locked build from run
`20261101-dark-reign2-native-mip-implementation`, commit `d86935e82`, was reused:
all 4,392 retained input hashes, 141 recorded reads, canonical module and
region-map mirror matched. No new build was needed. All 4,444 current source,
helper, compiler, test, and module pins stayed unchanged through the sweep.

Original fixture SHA-256 identities:

| Fixture | SHA-256 |
| --- | --- |
| projective-vertex | `32bae078f73402b8cbf9aaa43987f426967ca5e36686704ff98b0f101e09e4b7` |
| texcoord4 | `9b27ef8cd78aa56b56c5290bd398dc4302668e2395196d428a067aacac02d77f` |

Initial executions passed in 3.569s and 3.360s, exit 0. Their retained observer
covered `readFileSync` but missed the render-artifact helper's descriptor reads.
The scratch observer was extended to hash the actual assembled descriptor-read
bytes. Only these two fixtures were repeated, sequentially: 3.563s and 3.557s,
both exit 0. Each final execution captured 228 unique file/hash records,
including 130 `src/` files and the compiler inventory; all match current bytes.
Initial logs, modules, observer, exits and verification remain under
`initial-readFileSync-only/`; final evidence is at the run root.

Both executions instantiate the actual WAT software renderer through the
unchanged render harness. Both actual test modules have SHA-256
`d73eec82b958965566a41de7e4acd4d8990922cf2f727f19f8b41de4924a592a`
(2,026,958 bytes). Production is
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
Every non-custom section, all 12,982 function bodies and all exports match;
there are no additional test exports or functions in these fixtures. The
production module has a 37-byte custom section absent from the test modules,
so these are not production-byte-equal artifacts.

The projective-vertex fixture writes packed 19-float vertices directly and
calls `gl_sw_emit_packed19`. It verifies a fully textured row, w=1 boundary 16,
exact w=2 pixel equality, w=1|3 boundary 24, independent texture Q on both units
(boundary 8), near/far clipping, combined Q/position-w boundary 16 and identity
restoration. Its packed draws do not test the API vertex encoder.

The texcoord4 fixture drives draws through production `gl_wat_encoder_call`:
scalar/vector four-component texture coordinates, q reset by two-component
calls, r through a texture matrix, unit-1 scalar/vector calls, four- versus
two-component client arrays, projective/affine lines and unit-1 lines/points.
The projective boundary is column 8 of 32. Original opcode, packed-layout,
pixel equality, state-reset, boundary and point-sampling assertions all passed.
Setup calls use exported WAT software/matrix observers. The harness uses real
host imports/canvas with thread/event and COM hooks stubbed; these assertions
read the WAT-produced DIB pixels, rather than mocked raster output. This is
bounded software-renderer and encoder coverage, with no GPU, gameplay,
full27, or general crash-free claim.

The final scratch observer passed actual synchronous and asynchronous emitted
WAT execution with fixed shared 536,870,912-byte memory: whole-memory SHA-256
unchanged, native and host clock identities unchanged, and an emitted last-64
record window retained events 9,937 through 10,000 after 10,001 additions.
`offline-validation.json`, `verification.json`, original stdout/exit records,
actual modules and read inventories retain the checks. No repository source,
test, compiler, helper or configuration was edited. Startup free disk was
2,323,275,776 bytes; recorded sweep free space remained above 2 GB.

Own test processes/groups, board watcher and temporary resources are checked
absent in `cleanup.json`. Box ID/state/expiry: N/A (local native only).
The note is the sole tracked change. Runtime/source/build are released when
the final result and publication records are written; no further test is
required for this assignment.
