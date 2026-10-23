# Shadow Man static declaration-law repair (2026-10-23)

The Python inspector now enforces the supported stride/count, mask and size
power laws. **Repair checks pass; fresh independent acceptance is still required.**
This task does not accept itself, rebuild anything, or infer a defect in the
retained binaries. The earlier independent rejection correctly identified an
inspector contract gap protected separately by the fixed combined-source SHA
and compiler.

Base/rejected inspector candidate: `d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e`;
independent rejection: `b3d78c931cb50bd67da60aa58f6834f5df12d8fa`.
Old helper SHA256: `f7313b509c59cd6b01d51f9337b423d5e89c81e18df75ce233a9b308ce241cee`.
Corrected helper: adjacent `static-abi.py`, SHA256
`2507d350af9a96cb7dea47ab03df36674f07bd89ecc6c740acd37b4fc85d1bd8`.
The original inherited helper is retained unchanged; consume the new helper
beside this report. `helper.patch` records its entire delta.

## Declaration contract

The exact manifest-bound `tools/watx-src/compiler-codegen.js`, blob
`71d05cb80f8d87d3d879d6b1d6329a5c5eeaca8c`, 302257 bytes, SHA256
`84744dbdef3897f589f1c1465cc6d3025448250df09b1254369fdb16f73fa94d`,
was read, never executed. Adjacent `compiler-schema-and-laws.txt` retains the
full clause schema and law excerpts (compiler lines 1759–2006, 2161–2200).

| Supported clause | Independent check |
|---|---|
| `base` | Exactly one operand; fixed/span literal or derived `(g2w VA)` only; pinned source base/equation equals mirror placement. Derived GUEST_BASE must itself be pinned. |
| `size`, `end` | Exactly one operand, exactly one extent clause; allocated/derived require size; positive extent, exact source/mirror equality, memory and u32 bounds. |
| `align` | Exactly one literal; positive power of two; base is a multiple; default storage alignment 4. |
| `owner` | Exactly one quoted string; mandatory on spans. |
| `within` | Exactly one region name; mirror relationship agrees; parent exists, contains child and is not the child itself. |
| `stride` | Exactly `N (count N)`, each operand a literal or named immutable i32 constant global; both positive and exact product equals size. |
| `mask` | Exactly one named immutable i32 constant global; slots are stride count when present, otherwise byte size; slots positive power of two, global literal exactly slots minus one. |
| `size-is-power-of-2` | No operands; positive power-of-two size. |

The four supported heads remain allocated, fixed, derived and span. Spans accept
only base, size/end and owner and own no storage. Duplicate/unknown/incomplete
clauses and declarations fail. Globals are read from actual module-level source
forms, including globals after declarations. A mutable, non-i32, imported,
computed, malformed, missing or duplicate referenced constant cannot satisfy a
law; comments and nested declaration lookalikes cannot supply one. This explicitly
checks immutable-i32 structure rather than trusting the compiler's early
`constGlobals` initializer scan alone. Unsupported exported-global syntax is
rejected if referenced; it does not occur in this pinned law closure.

Integer tokens use the pinned compiler's complete signed decimal/hex grammar
with valid underscore separators, then this inspector limits values to i32/u32.
Declaration numeric operands are nonnegative u32; negative constant globals fail
positivity/value laws as appropriate. Size zero fails the extent check before
the power law (matching the compiler's earlier zero-size rejection). Arithmetic
never wraps: `0x80000001 * 256` cannot alias size 256. A successful size is at
most 512MiB, so exact Python product equality is equivalent to the compiler's
JS product for the accepted domain; larger unsupported operands are rejected
rather than approximating JS Number rounding. No signed-i32 reinterpretation
of a global literal is substituted for the compiler's literal value.

This remains a parser for the pinned closure, not a general compiler or a
WebAssembly validator. It streams nondeclaration bodies and does not expand
macros, replay the allocator or accept arbitrary WATX global forms. Existing
canonical `region.floor` placement and allocation history remain bound by source
identity and retained compiler evidence, not independently reallocated here.
`region.gap` and `region.image-base` overrides, absent from the pinned closure,
are explicitly unsupported; they cannot silently change the default g2w
equation. Storage placements, alignment, containment, bounds and complete
inventory remain checked; span serialization is unchanged.

## Python-only evidence

`run-checks.py --checks` is an explicit bounded Python-only entry point; it has
no compiler/native entry point and does not import the old build recipe.

| Check | Result |
|---|---|
| Original `test-static-abi.py` | Unchanged bytes, all 16 tests pass, exit 0. |
| New `test-declaration-laws.py` | 14 focused test methods with positive/negative subcases pass, exit 0. Covers source constants, stride/count positivity/equality/overflow, mask identity/value/byte-vs-count cardinality, nonpower slots, malformed syntax, zero/power size, comments/duplicates and pinned scope. |
| Original independent `reject-invalid-stride.py` | Unchanged bytes, no path-binding edit required; exit 0, `invalidStrideRejected: true`, exception `('stride/count size law', 'CS_RING', 8, 64, 256)`. Missing mask global does not hide the intended failure. |
| Full same-output static parse | Exit 0; detailed `static-abi.json` equals the prior retained report as a complete JSON value, including serialization, paths, signatures and all artifact identities. |

The first new suite run exited 1 because its zero-size diagnostic expectation
named a later bounds check while the power law rejected first. Evidence is kept
as `initial-declaration-law-tests.*`; no denial or resource limit was hit.
An explicit positive-extent check now matches the compiler's earlier ordering,
and the test requires that diagnostic. The corrected full sequence passes.

Complete inventory is **269 entries: 268 storage + DIRECT_WINDOW span**.
Sorted uppercase eight-digit `NAME:BASE:SIZE` lines with terminal newline still
derive **9a3bc9149d58209c**. The declared mirror hash is compared afterward and
is never the source of the computed hash. Full comparisons retain **291 imports,
2227 function exports and 172 binary types**, every function signature, exactly
one imported/exported shared memory **8192..32768**, no start section and exactly
one layout custom section with the exact entire fingerprint payload.

Same readonly retained outputs under
`/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build`:

| Artifact | Bytes | SHA256 |
|---|---:|---|
| wine-assembly.wasm | 1879746 | `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686` |
| wine-assembly.compat.wasm | 1882319 | `8590966d0fb0e015ee78d2f9897c5e87aff65861a58de0f7b392e549e099293d` |

Source candidate `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`, accepted source
`4dab22cfefb7b7048fbb6189b81cdccdd4ab8753`, build blob
`5407cb296ee6cdab2e30a226d1188206beb852af`, source blobs, mirror and pins are
unchanged. `source-bindings.json` rechecks only the consumed compiler/mirror/build
identities against manifest and Git blobs. The combined diagnostic remains
readonly at `/home/user/wine-assembly-shadow-man-complete-gate-data-readiness-oct23/build/combined.wat`,
20696217 bytes, SHA256
`68cdd92ea9f1702b1bf6c6f216fe2b725d4de11fe57a154bc035e5a81e07467b`.
It was used only for Python parsing, never compiler input. Explicit input root,
combined path and evidence output arguments remain mandatory; CLI source binding
and complete import/export/memory/custom constraints were not relaxed.

Accepted source/build/module/guard/52-gate/decoder evidence is reused, including
the coordinator's verified 53 canonical seals and 16 independent-rejection seals.
No repeat of those native/build/gate checks or default recipe `--run` occurred.
See prior canonical `recovery.md` and 140-file manifest for ignored binaries;
Git does not back up those retained outputs. Only the helper, tests, report and
evidence are published by this task.

## Resource and handoff

`light-admission.txt` records the single pre-execution measured projection:
**42404902 / 67108864 bytes**, including private Git/index/new objects, focused
checkout/helpers/tests/temp/evidence/capture, external launcher events/stderr,
separate session JSONL and future growth, and an 8MiB reserve. Host after the
entire projected peak: **5806818266 >= 2982150144 bytes**. Installed executables
run in place and readonly inputs/object stores are separately measured standing
dependencies; no links conceal new materialized bytes. Publication accounting
is in `publication-admission.json` and the external publication receipt.

All Python work has CPU/wall60s, regular-file24MiB and aggregate capture512KiB
limits; driver failures close with125, TERM then KILL after5s, subreaping and
full group reaping. Exact argv, exits, durations, captured bytes and empty
remaining groups are in adjacent receipts. The original board watcher is
terminated and reaped before handoff. No boxes assigned: ID/state/expiry N/A;
lifecycle ownership remains with the coordinator.

Only private branch `task/shadow-man-static-declaration-laws-repair-oct23` is
published, strict SSH with GIT_NO_LAZY_FETCH; actual remote SHA is independently
read back and recorded externally and on the append-only shared board. No
production/compiler/source/mirror/pin/oracle edits, donor mutation, compilation,
native Module/Memory/Instance/arena, Boat/browser/guest, shared ref/main/integration,
merge or deploy occurred. POSITIONT native ownership, RichEdit, Claude B&W2 and
laptop work remain untouched. No new workers/refill were launched. Stop this
bounded task; the coordinator owns independent acceptance and any follow-up.
