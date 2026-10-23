# Shadow Man static inspector independent acceptance — 2026-10-23

Verdict: **ACCEPT_SCOPED_STATIC_INSPECTOR**. This independent Python-only run
accepts the corrected inspector at repair commit
`9ceffa0c7927431fc0ea575ee5ad2318f68e494c`, branch
`task/shadow-man-static-declaration-laws-repair-oct23`. All original 16 tests,
all new 14 tests, the unchanged rejecting probe, three independent negative
controls and retained-module static inspection executed successfully, exit 0.
The candidate inspector and donor tests were not edited.

The helper is adjacent `static-abi.py`, 15587 bytes, SHA256
`2507d350af9a96cb7dea47ab03df36674f07bd89ecc6c740acd37b4fc85d1bd8`.
Its canonical predecessor SHA256 is
`f7313b509c59cd6b01d51f9337b423d5e89c81e18df75ce233a9b308ce241cee`.
The complete retained `helper.patch` was applied independently: all 13 hunks
matched exact old lines and both range counts; the resulting entire bytes
equal the candidate. Diff-format string equality was deliberately replaced
under the coordinator's explicit authorization. `input-verification.json`
and `verify-inputs.receipt.json` retain the proof and exact inputs.

Compiler standing input is
`/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/tools/watx-src/compiler-codegen.js`,
302257 bytes, Git blob `71d05cb80f8d87d3d879d6b1d6329a5c5eeaca8c`,
SHA256 `84744dbdef3897f589f1c1465cc6d3025448250df09b1254369fdb16f73fa94d`.
The excerpt is exactly inclusive lines **1759–1810, 1890–2006, 2161–2200**,
11191 bytes, SHA256
`9aee170db719a6bcc979c007091635f7c537f2e2333471cc9a0ee4b015c98b12`.
The donor report's contiguous 1759–2006 description and predecessor verifier
assertion were incorrect metadata; the three-range selection matches the
retained bytes. The task-local correction changes no semantic tests or inputs.
Historical reports and their failures remain untouched. The full verifier
and acceptance command sequence were reviewed before execution.

The read-only build contract `tools/build-compile-wat.js` has SHA256
`ef0833c055363f71f383eee1b2d285c3521d151e8a4048123c36ba920c5e6c87`.
Source candidate is `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`;
source acceptance is `4dab22cfefb7b7048fbb6189b81cdccdd4ab8753`.
Manifest-bound source identities were independently matched by bytes,
SHA256 and Git blob computation: mirror blob
`7f96dd1a81886946eb5fccefd5676c24e9016349`, SHA256
`1f1edfd8f13ef528434828243e8f1e37a059d2c4136dc7aaa1427b91e629e968`;
build.sh blob `5407cb296ee6cdab2e30a226d1188206beb852af`, SHA256
`5ca2278e733bea26d8c261b993006424b845bc9328753d1b1506119e4608b5ef`.
No compiler or build contract was executed.

## Semantic review and executed controls

The complete helper delta preserves the previous binary ABI comparison,
source/mirror placement checks and span serialization. Its selected-form
stream accepts region/global declarations only at module level, rejects
nested lookalikes, and handles comments through the existing tokenizer.
It scans globals before applying laws, so later globals are available.
Referenced constants must have exactly the immutable i32 literal form;
mutable, imported, computed, malformed, duplicate or non-i32 forms fail closed.
Unsupported exported-global syntax also rejects when used for a law.
This is deliberately stricter than the compiler's early initializer scan.

| Contract | Review and replay |
|---|---|
| Clause schema | Single operand for ordinary clauses; no operands for power law; exact `stride N (count N)` structure; duplicate, unknown and incomplete clauses reject. Span clauses remain restricted to base, extent and owner. |
| Stride/count | Literals or actual immutable i32 globals; both positive; exact Python product equals extent. No wrapping or floating-point approximation can accept an overflow alias. |
| Mask | Must name an immutable i32 global. Cardinality is count with stride, otherwise byte size; positive power-of-two cardinality; exact value cardinality minus one. |
| Power | Positive extent and exact power-of-two size. Zero rejects before the power check. |
| Placement | Original fixed/allocated/derived/source/mirror extent, alignment, containment and bounds checks retained; derived g2w requires pinned GUEST_BASE; gap/image-base overrides reject. |

`original16.receipt.json`: unchanged original test bytes, 16 tests, OK, exit 0.
`new14.receipt.json`: unchanged donor law-test bytes, 14 tests, OK, exit 0,
including malformed syntax, positivity, product/overflow, globals, mask
cardinality/value, power, spoofing and all declaration heads.

`unchanged-rejecting-probe.receipt.json`: the probe from rejection
`b3d78c931cb50bd67da60aa58f6834f5df12d8fa` is byte-identical to its
retained original. CS_RING size 256 / stride 8 / count 64 now rejects with
`('stride/count size law', 'CS_RING', 8, 64, 256)`. Exit 0 means that the probe
confirmed this intended rejection.

`independent-controls.receipt.json`: reused and independently reviewed
predecessor controls first accept a matching derived-region/global fixture,
then reject three meaningful mutations: stride 4 × count 128 versus size 256;
mask 255 for count 128; exported syntax used for a law global. Each rejection
matches its intended law. These controls add derived-placement and global
cardinality coverage without changing source/mirror extents to manufacture
an unrelated failure. No further harness expansion was needed.

The repair's initial diagnostic-expectation run **failed**, exit 1, 14 tests
with one failure. It expected `inventory bounds|^$` for zero size but received
`size-is-power-of-2 law`. Raw original receipt/stdout/stderr are preserved as
JSON strings beside this report. This is historical failure evidence, never
counted as a passing run. The new executions above use the exact final donor
helper and tests.

## Retained-module static result

`module-static.receipt.json` and `verify-results.receipt.json` both exit 0.
`static-abi.json` equals the **entire old detailed parsed JSON**, including
every type, import/export signature, memory and custom-section record.
`acceptance-results.json` records the explicit postconditions: 269 inventory
entries = 268 storage + DIRECT_WINDOW, complete serialization fingerprint
`9a3bc9149d58209c`, 291 imports, 2227 function exports, 172 types, exactly one
shared memory 8192..32768 pages, no start section and exactly one layout
custom section whose whole payload is the 16 ASCII fingerprint bytes.

| Same retained artifact under canonical donor `build/` | Bytes | SHA256 |
|---|---:|---|
| wine-assembly.wasm | 1879746 | `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686` |
| wine-assembly.compat.wasm | 1882319 | `8590966d0fb0e015ee78d2f9897c5e87aff65861a58de0f7b392e549e099293d` |

Read-only combined input:
`/home/user/wine-assembly-shadow-man-complete-gate-data-readiness-oct23/build/combined.wat`,
20696217 bytes, SHA256
`68cdd92ea9f1702b1bf6c6f216fe2b725d4de11fe57a154bc035e5a81e07467b`.
It was only parsed by Python, never compiled. Existing build/source/module,
recovery and gate evidence and coordinator-verified donor seals are reused;
no duplicate packaging, recovery or build work was performed. Git does not
preserve these ignored binaries; retain their canonical donor and existing
recovery recipes.

## Resource and publication disposition

Measured admission: **42749100 / 67108864 bytes**, including focused copies,
private Git/index/new objects/temp/evidence/capture allowance, external launcher
events/stderr and future growth, separately measured Codex session and future
growth, and 8MiB reserve inside the allocation. Host free after the entire
projection: **5455328084 >= 2982150144 bytes**. `admission.json` lists measured
focused identities, separately hashed standing installed tools/donors and
standing object-store footprints. Installed tools executed in place.
Actual process 1931069 argv verifies fresh gpt-6.1-sol medium, 200000 TOTAL
auto-compaction; no worker launch occurred here.

Every check has CPU/wall 60s, file 24MiB, aggregate captured stdout+stderr
512KiB across commands, fail-closed 125, TERM then KILL after 5s, subreaper and
full descendant reaping. Receipts preserve raw argv, exits, bounded streams
as JSON strings, elapsed times and empty remaining-process lists. All check
groups reaped. The board watcher received TERM and was joined, exit 143.
Publication remeasures resource admission and continues cumulative capture
accounting in the external launcher directory. `seals.json` binds authored
report/evidence bytes before staging; strict whitespace and owned-path scope
checks precede the single coherent report commit and prompt push. Strict
existing known-host/key verification and GIT_NO_LAZY_FETCH remain enabled;
external `publication.json` and the append-only messageboard record the actual
remote SHA after publication.

This accepts a static inspector for these pinned inputs, not a general WATX
compiler or WebAssembly validator. Allocation history/region.floor, full
compiler validation, native compilation/disassembly, instantiation, memory
allocation, browser/guest behavior and gameplay remain separately qualified
by existing or future evidence. Binaries were not shown defective. No Node,
compiler, native Module/Memory/Instance/arena, Boat, guest, browser or runtime
was used. No boxes assigned: ID/state/expiry N/A; lifecycle stays with the
coordinator. POSITIONT/RichEdit, Claude B&W2, laptop and shared integration
ownership remain untouched. No shared source/ref/index mutation, merge,
force push, deployment, replacement work or worker/refill occurred. This
bounded acceptance task stops after publication.
