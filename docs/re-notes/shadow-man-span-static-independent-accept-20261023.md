# Shadow Man independent static acceptance: REJECT

Reviewed candidate **d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e**, branch
`task/shadow-man-span-static-canonical-oct23`. Inspector SHA256:
`f7313b509c59cd6b01d51f9337b423d5e89c81e18df75ce233a9b308ce241cee`.
Source candidate b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a and accepted source
4dab22cfefb7b7048fbb6189b81cdccdd4ab8753 remain unchanged.

The complete span serialization repair works for the pinned input, but the
requested independent rejection of invalid declarations is incomplete. The
inspector's `declarations()` accepts `stride`, `mask`, and `size-is-power-of-2`
clauses; `inventory()` never validates those laws. This is a supported form
already used in the pinned closure, not an exotic parser extension.

The minimal independent regression uses the pinned CS_RING declaration, with
stride changed from 4 to 8 while size stays 256 and count stays 64. The isolated
fixture mirror places it at aligned base 0x100. The compiler requires
`stride * count == size` and rejects 512 != 256. The inspector returns a valid
inventory and computed fingerprint `3d574b11c1c140e6`. The rejection assertion
therefore exits **1**, demonstrating the gap. See adjacent
`reject-invalid-stride.py`, `independent-rejecting-test.stdout/.json`,
`pinned-CS_RING.txt`, and `compiler-law-excerpt.txt`. Compiler semantics were read
from the exact manifest-bound `tools/watx-src/compiler-codegen.js`, especially
lines 1909–1921 and 2162–2197; no compiler was run.

This finding concerns the independent declaration validator's acceptance
contract. It does **not** demonstrate corruption of the retained artifacts or
bypass of the CLI's fixed combined-source SHA256. A complete source mutation
would fail that SHA check before inventory inspection. The declaration helper
must not be described as independently rejecting all invalid declarations merely
because an immutable source digest and the earlier compiler protect this run.
No repair, weaker assertion, second rejecting probe or broad fuzzing was attempted.

The original **16 focused tests pass, exit 0**, 1.857 seconds. They include the
exact readonly candidate and reconstruct 268 storage placements plus DIRECT_WINDOW
as one span, yielding **9a3bc9149d58209c**. The old storage-only
b0f1d4c2a339d18f remains inadequate. Source fixed/derived bases, extents,
alignment, containment, duplicate/missing inventory and bounds are checked.
The hash is computed from sorted `NAME:BASE:SIZE` uppercase eight-digit hex
records and a terminal newline, matching `tools/region-layout-hash.js:51–60`;
the mirror's declared hash is compared afterward, never substituted.

The derived-base equation uses GUEST_BASE + guest VA - 0x400000, agreeing with
the compiler default for this pinned closure, which contains no image-base
override. Do not generalize this parser to an overridden image base, arbitrary
WAT headers, or arbitrary WebAssembly validation. The explicit CLI arguments bind
the input-root mirror and both build outputs, combined source, and output evidence
directory. Combined SHA256 is fixed to
68cdd92ea9f1702b1bf6c6f216fe2b725d4de11fe57a154bc035e5a81e07467b.
The recipe separately admits exact source/mirror blobs and staged pins; the helper
alone does not authenticate the root as a Git candidate.

The binary comparison retains full import and export signatures, not only names
or counts, with exactly one imported/exported shared memory (8192..32768 pages),
no start section and exactly one `wine-region-layout` custom section whose whole
payload must equal the derived 16-character fingerprint. Raw retained evidence
reports 291 imports, 2227 function exports, 172 types per binary and 269 placements.
The independent parser is an ABI inspector, not a replacement for native binary
validation. Existing native qualification evidence is reused, not rerun.

Coordinator-accepted integrity/build results are reused: all 53 retained and
committed seals, candidate remote SHA, and main
bb9c496ed13095cc832fdf607f0937fb9c14b7de. Raw backend, qualifier, output,
admission, recovery, helper delta and static reports were inspected. The authentic
backend receipt records one invocation, exit 0, 5.006 seconds; both pinned
qualifiers exit 0 under guard. Original build blob
5407cb296ee6cdab2e30a226d1188206beb852af is unchanged. Outputs remain readonly:

| Artifact | Bytes | SHA256 |
|---|---:|---|
| primary | 1879746 | 8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686 |
| compat | 1882319 | 8590966d0fb0e015ee78d2f9897c5e87aff65861a58de0f7b392e549e099293d |

The detailed static report filename was initially overwritten by its successful
driver receipt. The corrected receipt name is `static-inspection-driver.json`;
recovery reparsed only in Python. There was no backend/native retry. Adjacent
`review-evidence.json` retains the relevant raw receipts and exact bindings.
Ignored binaries are not backed up by this review commit. Original donor
`docs/re-notes/shadow-man-span-static-canonical-20261023/recovery.md` and its
140-file manifest retain recovery references; the consumed recipe must not be
rerun. No executable native next command is authorized by this REJECT verdict.
Coordinator must assign a bounded correction/review before accepting the stronger
declaration rejection contract.

Light admission projected **34,121,245 / 67,108,864 bytes**, including all private
Git/index/new objects/checkout/helpers/evidence/temp/captures, external launcher
events/stderr, separate session JSONL and future growth, and 8MiB reserve. Host
free after projected growth was **5,849,704,931 >= 2,982,150,144 bytes**.
Installed executables run in place; donor inputs are readonly standing bytes.
Both Python commands used CPU/wall60s, file24MiB, aggregate capture512KiB,
fail-closed125, TERM+5s KILL, subreaping and full group reap. Final publication
accounting is retained adjacent and externally. Initial private Git `read-tree`
failed because the donor alternate chain exceeded Git's nesting depth; explicit
direct standing alternates corrected the private setup without donor changes,
fetches, discarded work, or an unchanged retry. This was not a denied resource
admission. The board watcher is terminated before final handoff.

**No uninstrumented canonical, native Module/Memory/Instance, arena, compilation,
guest, handler zero-writer, persistence, reopen or Play qualification was done.**
Native/guest prerequisites and pending lifetime entries/CJS gap remain outside
this verdict. POSITIONT owns native qualification independently. No worker
launch/refill, Boat/browser/box, donor mutation, shared ref/main/integration,
merge or deployment action occurred. RichEdit, Claude B&W2 and laptop claims are
preserved. No owned test process groups remain; no box assigned (ID/state/expiry
N/A), shutdown ownership stays with the coordinator. Stop this bounded task.
