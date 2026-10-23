# Shadow Man declaration-law independent acceptance: blocked (2026-10-23)

**BLOCKER_REVIEW_DIFF_COMPARISON — acceptance incomplete.** The first guarded
verification command exited 1 before any acceptance tests or retained-module
inspection. The worker's strict equality assertion between Python difflib's
generated unified diff and retained `helper.patch` failed. This compares diff
representations, rather than applying the retained patch and comparing resulting
bytes; its failure alone establishes neither an incorrect patch nor an inspector
defect. No repair, altered assertion, unchanged retry or subsequent acceptance
execution occurred. The failing verifier and complete raw receipt are adjacent.
The coordinator must resolve this review-harness blocker before assigning any
further acceptance work. This report does **not** issue ACCEPT_SCOPED_STATIC_INSPECTOR.

## Exact inputs and review completed

The read-only repair donor is
`/home/user/wine-assembly-shadow-man-static-declaration-laws-repair-oct23`,
commit `9ceffa0c7927431fc0ea575ee5ad2318f68e494c`, branch
`task/shadow-man-static-declaration-laws-repair-oct23`. Its report is
`docs/re-notes/shadow-man-static-declaration-laws-repair-20261023.md`.
Coordinator-verified 32 retained/committed seals and strict remote head are
reused, not repackaged or independently claimed reverified here.

The copied corrected helper SHA256 is
`2507d350af9a96cb7dea47ab03df36674f07bd89ecc6c740acd37b4fc85d1bd8`.
Before the failing assertion, verification checked all four copied helper/test
files against repair donor bytes, original 16-test file against the canonical
donor, and the unchanged independent rejecting probe against its original donor.
Those comparisons completed; no test files executed.

Compiler standing input is the canonical donor's
`tools/watx-src/compiler-codegen.js`, 302257 bytes, SHA256
`84744dbdef3897f589f1c1465cc6d3025448250df09b1254369fdb16f73fa94d`,
Git blob `71d05cb80f8d87d3d879d6b1d6329a5c5eeaca8c`.
Canonical donor root:
`/home/user/wine-assembly-shadow-man-span-static-canonical-oct23`.
The verifier checked compiler, mirror and build.sh bytes against the canonical
manifest and source-bindings entries, including Git blob hashes computed from
the actual bytes. Candidate remains
`b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`; source acceptance is
`4dab22cfefb7b7048fbb6189b81cdccdd4ab8753`.
Mirror blob is `7f96dd1a81886946eb5fccefd5676c24e9016349`, SHA256
`1f1edfd8f13ef528434828243e8f1e37a059d2c4136dc7aaa1427b91e629e968`;
build.sh blob is `5407cb296ee6cdab2e30a226d1188206beb852af`, SHA256
`5ca2278e733bea26d8c261b993006424b845bc9328753d1b1506119e4608b5ef`.
The read-only build compiler contract `tools/build-compile-wat.js` SHA256 is
`ef0833c055363f71f383eee1b2d285c3521d151e8a4048123c36ba920c5e6c87`.
Neither compiler nor contract was executed.

Manual review read the whole helper delta, helper, retained schema/laws excerpt,
new 14-method suite, original 16-test suite and unchanged rejecting probe. Actual
compiler sections for heads, globals, extents and laws were read directly at the
correct standing path. The automated schema-excerpt equality assertion occurs
after the failed diff assertion and was **not reached**.

The delta introduces clause arity validation; module-level source-form selection;
immutable literal i32 global extraction; strict signed decimal/hex token parsing
within i32/u32 bounds; positive stride/count with exact Python multiplication;
mask cardinality from count when strided or byte size otherwise; positive
power-of-two slots and exact slots-minus-one value; and explicit positive extent
before size-power checks. It also pins the g2w prerequisite and rejects self
containment. Span handling, detailed source/binary ABI comparison and full payload
comparison remain visible in the helper. These are review observations, not a
passing independent acceptance result.

The compiler's early constant scan is looser than the inspector's structural
immutable-i32 requirement. The helper intentionally rejects referenced mutable,
computed, imported, malformed and unsupported exported-global forms rather than
trying to accept every compiler syntax. It is scoped to the pinned closure,
not a general WATX validator, macro expander or allocator replay.

## Checks not completed

| Required check | This worker's result |
|---|---|
| Original 16 Python tests | NOT RUN |
| New 14 Python test methods | NOT RUN |
| Unchanged CS_RING rejecting probe | NOT RUN |
| Independent derived-region controls | Authored and retained, NOT RUN |
| Same retained modules, Python static parse | NOT RUN |
| Exact detailed old JSON equality | NOT RUN |
| Complete inventory / ABI / custom payload | NOT independently revalidated |

The unchanged prior rejection probe requires size256/stride8/count64 to reject
because 8*64 != 256. Its missing mask global must not substitute for the intended
stride/count size-law rejection. Independent additional controls were prepared
for a derived region with named stride/count globals: mismatched product, wrong
byte-size mask despite valid count, and unsupported exported law-global syntax.
They include a positive derived/global baseline but were never executed.

The repair donor's initial new-suite run really failed: exit1, 14 methods with
one failure. Its zero-size test expected `inventory bounds|^$`, but received
`('size-is-power-of-2 law', 'R', 0)`. Raw receipt and streams are preserved as
JSON strings with original bytes/hash, explicitly as historical failure evidence.
The repair subsequently added positive extent validation and adjusted the test;
its later passing evidence remains donor evidence, not this worker's replay.

Admission independently read and verified the following same retained identities:

| Read-only retained artifact | Bytes | SHA256 |
|---|---:|---|
| canonical build/wine-assembly.wasm | 1879746 | `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686` |
| canonical build/wine-assembly.compat.wasm | 1882319 | `8590966d0fb0e015ee78d2f9897c5e87aff65861a58de0f7b392e549e099293d` |
| readiness build/combined.wat | 20696217 | `68cdd92ea9f1702b1bf6c6f216fe2b725d4de11fe57a154bc035e5a81e07467b` |

Combined input remains at
`/home/user/wine-assembly-shadow-man-complete-gate-data-readiness-oct23/build/combined.wat`.
It was only hashed, never compiled. Required retained expectations remain
269 inventory entries (268 storage + DIRECT_WINDOW), fingerprint
`9a3bc9149d58209c`, 291 imports, 2227 function exports, 172 types,
one imported/exported shared memory 8192..32768, no start and exact full custom
payload. Native validation, native compilation, guest/runtime and gameplay
qualifications remain outside this task; retained binaries are not shown defective.

## Resource, evidence and disposition

Measured pre-execution admission passed at **42628482 / 67108864 bytes**.
It includes a 16777216-byte focused checkout/private Git/index/new objects,
copies/temp/evidence/capture allowance, measured launcher events/stderr with
4194304 future bytes, separate measured Codex session with 12582912 future bytes,
and 8388608 reserve inside the allocation. Host free was 5512314880;
after the entire projected peak, 5469686398 >= 2982150144 bytes.
Standing installed Python/Git/SSH and read-only donor/object-store inputs are
separately identified and measured in admission.json. No new tool installation,
hidden materialized link copies or binary copies were made.

Session `01a16794-30a3-7f90-84b1-25cecf6743c8` was launched by the coordinator
with gpt-6.1-sol, medium reasoning and 200000 TOTAL auto-compaction; the actual
live argv is retained in admission.json. This worker spawned no agents/workers.

The guard was constructed before execution: child CPU60s/wall60s, regular
file25165824 bytes, aggregate stdout+stderr524288 bytes across recorded commands,
failclosed125 for guard violations, TERM then KILL after5s, Linux subreaper and
full descendant/group reap. The first failed verifier used 0.062s wall, captured
481 stderr bytes, exit1 (no guard violation), no remaining processes.
Exact argv, exits and raw streams are in JSON receipts, preserving whitespace.
All setup groups were also reaped. No acceptance check followed the failure.

Publication is one coherent report/evidence commit on private branch
`task/shadow-man-declaration-laws-correct-path-accept-oct23`; no shared source,
index, ref or integration mutation. Adjacent seals cover retained report/evidence;
publication and actual strict remote-SHA receipts are retained externally under
`/home/user/wine-assembly/scratch/usage-watch/shadow-man-declaration-laws-correct-path-accept-oct23`.
POSITIONT integration, RichEdit, Claude B&W2 and laptop ownership are preserved.
No force push, merge, deployment, compiler/Node/native Module/Memory/Instance,
arena, Boat, guest, browser or runtime operation occurred. No box assigned:
ID/state/expiry N/A; lifecycle remains coordinator-owned. Stop this bounded task.
