# Native GL stencil/depth fixture observation — 2026-11-01

`test/test-opengl-stencil.js` passed unchanged on native Node 24.18.1,
exit **0** in **7.990 seconds**, under a sequential 120-second timeout.
The complete 8,719-byte fixture was read before execution; SHA-256:
`411833ed93bd2fc12caeb806d7a9e85a88dea30709dbafa41f4841efb6395f59`.
No matching accepted complete-input test result was found, so this assignment
executed the fixture once. No production, test, helper, or configuration edits.

| Fixture contract | Observed outcome |
| --- | --- |
| Default stencil queries; masked clears; one-pixel scissor clear | PASS, including neighboring pixel preservation |
| Point stencil replacement and software color | PASS, stencil 7 and red `0xffff0000` |
| Alpha rejection before stencil/depth | PASS, rejected alpha leaves stencil 7 |
| Stencil-fail, depth-fail, depth-pass operations | PASS, increment/decrement/invert paths |
| All eight stencil comparisons | PASS, reference compared against stored stencil |
| Stencil rejection cannot write nearer depth and reject a farther fragment | PASS, subsequent farther fragment writes stencil 7 |
| Saturating increment/decrement, ZERO, KEEP, read/write masks | PASS |
| Triangle and line stencil spans | PASS, stencil 12 then 13 |
| Reference clamping, invalid enums, begin/end state protection | PASS |
| Attribute masks, context isolation/deletion, display-list state | PASS |
| Unsupported stencil-index readback | Expected `WebAssembly.RuntimeError` caught by the fixture |
| Invalid clear bits and invalid display-list stencil function | Expected GL errors asserted |
| Stencil attachment allocation failure | PASS, ensure returns 0 and GL error `0x505` |
| Attachment resize to 8×8 and back to 16×16 | PASS, pitch and all 64 cleared bytes asserted |
| Two queued draws with immutable stencil snapshots | PASS, manual native worker-draw replay produces stencil 4 |
| Reset releases the owned stencil attachment | PASS, pointer becomes 0 |

The raw log's heap refusal for `4294836225` bytes (`0xfffe0001`) is the
intentional allocation-failure case, followed by the fixture's final PASS.
There was no unexpected assertion failure and no repair or weakened assertion.

## Gate, build and actual module

Evidence: `scratch/runs/20261101-gl-stencil-depth/` (ignored).
Predecessor `Incoming01a196a6-6ab0-7e43-9802-e5be6bb9f096` supplied fresh
launcher `final.txt` and `result.json` and an explicit runtime/source/build
RELEASE at 10:47:38 UTC. The gate watcher observed both at 10:47:47 UTC;
source/test/build access followed that gate. Actual main was
`c834033c1adfb181a2e3d372be618fd739c71b06`, advanced from the assigned
`558e59dcf36b92471184154015cb46ac7b563950`. Runtime allowance ended
11:02:47 UTC, within the overall 13:15 deadline.

The accepted canonical locked-build evidence from
`20261101-dark-reign2-native-mip-implementation` was reused: all 4,392
accepted input hashes and all 141 recorded build reads matched, as did
the canonical module and generated region mirror. No canonical rebuild was
needed. All 4,444 currently pinned inputs matched before/after execution.

Canonical module SHA-256:
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
Actually instantiated fixture module SHA-256:
`98741a0c50f0f7713bd306d2a6ec56eefc26200b34907bc454f7cdcb3731fd0e`
(2,027,097 bytes). It is not byte-identical to the canonical module:
all **12,982 production function bodies** are exact matches and all production
exports remain, while the unchanged fixture adds three functions/exports:
`stencil_pixels`, `stencil_pitch`, and `stencil_allocation_failure`.
Noncustom sections 3, 7 and 10 differ accordingly; other noncustom sections
match. The canonical 37-byte custom section is absent from the test module.
`verification.json` retains section hashes and all three added function bodies.

The read observer recorded 201 unique file/hash records, including 130
`src/` files; all still matched at verification. Raw compressed output,
Node exit metadata, actual module bytes, source snapshots, build-reuse proof,
fixture copy and verification are retained in the run directory.

## Observer and limits

The exact accepted observer and offline fixture from
`20261101-gl-software-projective` were reused with matching hashes and
input proof. Retained raw compressed output, exit 0 and validation show actual
synchronous and asynchronous Wasm execution, before/after hashing of the whole
512 MB shared memory, unchanged host/native clock identities, and emitted
late retention through event 10001 (last 64 retained). The observer records
`readFileSync`, complete bounded descriptor reads, Wasm compilation and
instantiation; it does not establish exhaustive asynchronous filesystem,
streaming, preloaded-module, or guest-memory diagnostic coverage.

This fixture executes native WAT/software rasterization and queue contracts.
Its host override intercepts GL commands and captures queued draws; replay
calls the native software worker export directly. This does not establish GPU
execution, original-game pixels, rendering parity, real worker-thread
scheduling, full27 membership, or general gameplay/crash freedom.

Disk samples stayed above 2,000,000,000 bytes: wait minimum 2,030,944,256;
test minimum 2,028,408,832. No separate startup or RAM gate, foreign cleanup,
browser, GPU, boat, download, deployment, worker launch or source repair.
Local native box ID/state/expiry are N/A. Own timeout process group and driver
exited; no test-created temporary path remained. Publication watcher cleanup
and strict-host-key remote verification are retained with the final result.

Next: use this as the bounded native stencil/depth result. GPU, original-game
pixels and parity require separate evidence outside this assignment.
