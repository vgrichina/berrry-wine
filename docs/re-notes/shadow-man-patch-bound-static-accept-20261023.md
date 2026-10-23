# Shadow Man patch-bound static acceptance — 2026-10-23

**BLOCKER_COMPILER_EXCERPT_IDENTITY — acceptance incomplete.** The first guarded
input-verification command exited 1 at the retained compiler-excerpt identity
assertion. Acceptance stopped immediately; no assertion repair, retry, original
16 tests, new 14 tests, unchanged rejecting probe, independent controls, or
retained-module static inspection ran in this session. This is not a rejection
of the inspector's declaration laws and establishes no defect in either binary.

The authorized replacement for the obsolete diff-string assertion **passed**:
all 13 retained unified hunks applied against exact canonical old lines with
old/new range and count checks, and the entire resulting bytes equalled the
corrected helper. Execution then reached the excerpt assertion at line 47 of
adjacent `verify-inputs.py`. The failed verifier and its exact bounded receipt
are retained unchanged. No obsolete diff-string comparator was executed.

The excerpt is 11191 bytes, SHA256
`9aee170db719a6bcc979c007091635f7c537f2e2333471cc9a0ee4b015c98b12`.
Read-only localization identifies exact consecutive compiler blocks
**1759–1810, 1890–2006, 2161–2200**. The inherited assertion and repair report
instead claim **1759–2006, 2161–2200**, which yields 15015 bytes, SHA256
`ef2c156b3fdc944d53656b7ac8a7bdf1049be54300e32243d3a9bd13b3d40768`.
The omitted 79 lines are 1811–1889. See `excerpt-failure-localization.json`.
This is a distinct input-contract mismatch after the coordinator-resolved
patch-format issue; that historical failure was not reproduced.

The coordinator must resolve the excerpt identity contract and authorize any
additional harness correction before acceptance resumes. The worker stopped
under the explicit first-unexpected-failure rule. No replacement work was chosen.

## Exact identities

Repair donor: `/home/user/wine-assembly-shadow-man-static-declaration-laws-repair-oct23`,
commit `9ceffa0c7927431fc0ea575ee5ad2318f68e494c`, branch
`task/shadow-man-static-declaration-laws-repair-oct23`. Coordinator verification
of its 32 retained/committed seals and strict remote head was reused.

| Input | Exact identity |
|---|---|
| Corrected helper, 15587 bytes | SHA256 `2507d350af9a96cb7dea47ab03df36674f07bd89ecc6c740acd37b4fc85d1bd8` |
| Canonical old helper | SHA256 `f7313b509c59cd6b01d51f9337b423d5e89c81e18df75ce233a9b308ce241cee` |
| Retained helper.patch, 5056 bytes | SHA256 `f01e89da649ee3d47405efa4cdd20da85dd18f22197559e5f1de4563d7ee5d3f` |
| Compiler, 302257 bytes | blob `71d05cb80f8d87d3d879d6b1d6329a5c5eeaca8c`; SHA256 `84744dbdef3897f589f1c1465cc6d3025448250df09b1254369fdb16f73fa94d` |
| Build compiler contract, read only | SHA256 `ef0833c055363f71f383eee1b2d285c3521d151e8a4048123c36ba920c5e6c87` |
| Source candidate / accepted source | `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a` / `4dab22cfefb7b7048fbb6189b81cdccdd4ab8753` |
| Build script | blob `5407cb296ee6cdab2e30a226d1188206beb852af` |
| Mirror | blob `7f96dd1a81886946eb5fccefd5676c24e9016349`; SHA256 `1f1edfd8f13ef528434828243e8f1e37a059d2c4136dc7aaa1427b91e629e968` |
| Primary module, 1879746 bytes | SHA256 `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686` |
| Compat module, 1882319 bytes | SHA256 `8590966d0fb0e015ee78d2f9897c5e87aff65861a58de0f7b392e549e099293d` |
| Combined diagnostic, 20696217 bytes | SHA256 `68cdd92ea9f1702b1bf6c6f216fe2b725d4de11fe57a154bc035e5a81e07467b` |

Compiler, build contract, mirror and modules remain under the canonical standing
donor `/home/user/wine-assembly-shadow-man-span-static-canonical-oct23`.
Combined input remains under
`/home/user/wine-assembly-shadow-man-complete-gate-data-readiness-oct23/build`.
Admission measured and hashed these inputs; no binary was copied or compiled.
Source bindings additionally passed manifest/size/SHA256/Git-blob comparison
before the verifier failed. Original test/probe byte identities also passed.

## Semantic review, pending execution

The exact helper delta was reviewed against the standing compiler and retained
schema/law blocks, without executing JavaScript. It adds no binary-parser or
ABI-comparison relaxation.

| Property | Reviewed behavior and qualification |
|---|---|
| Clause arity | Ordinary clauses require one operand; power clause requires none; stride requires exactly an operand and `(count operand)`. Unknown, duplicate and malformed clauses fail. Spans permit only base, extent and owner. |
| Globals | Actual module-level forms are scanned, including forms after regions. Only named immutable `i32 (i32.const literal)` forms resolve. Duplicate names reject; mutable, imported, computed, exported and malformed referenced forms cannot satisfy a law. This is deliberately stricter than the compiler's early initializer scan. |
| Positive product | Positive stride and count are required; exact Python multiplication must equal source/mirror size. No i32 wrapping can alias size 256. Accepted extents stay within 512MiB, avoiding JS-number approximation in the accepted product domain. |
| Mask | Slots mean stride count when present and byte size otherwise. Positive power-of-two slots and exact constant `slots - 1` are required. |
| Size power | Positive extent is checked before the power-of-two law; the latter uses exact arithmetic. |
| Unsupported forms | Image-base overrides, gaps, nested declarations, unsupported constants and literal spellings reject in the supported closure. This is not a general WATX parser, macro expander, allocator replay, or WebAssembly validator. |
| Existing contracts | Source/mirror names and extents, derived g2w equation, alignment, containment, span inventory, complete source ABI/signatures, shared memory, no-start and exact layout payload checks remain in place. |

The unchanged prior rejection probe must still reject CS_RING size 256 with
stride 8 and count 64 for **stride/count size law**, not a missing mask global.
It is retained but **unrun here**. The additional independent controls, also
unrun, use a derived region with globals and matching source/mirror extents:
valid stride 2/count 128, invalid stride 4, byte-mask 255 instead of count-mask
127, and unsupported exported mask-global syntax. They test intended laws
without a source/mirror-size mismatch obscuring the result.

The required full replay remains outstanding: original 16 + new 14 methods,
unchanged rejecting probe and independent controls, then Python-only inspection
of the same retained modules with exact complete old JSON equality. It must
establish inventory 269 = 268 storage + DIRECT_WINDOW, fingerprint
`9a3bc9149d58209c`, 291 imports, 2227 function exports, 172 types, sole shared
memory 8192..32768, no start, and exact custom payload. Donor passing receipts
are historical evidence and are not substituted for independent execution.

The repair's initial new-suite run **failed**, exit 1: the zero-size test expected
`inventory bounds|^$`, while the helper raised `size-is-power-of-2 law`.
Its full original receipt/stdout/stderr are retained as raw JSON strings.
The later repair added an explicit positive-extent check and changed the
expectation; its reported passing run does not turn the initial failure into
a pass. The predecessor reports and coordinator patch proof remain untouched.

## Resource and publication disposition

Measured admission: **42588188 / 67108864 bytes**, host after entire projected
peak **5269100516 >= 2982150144 bytes**. This includes private Git/index/new
objects, focused copies, temp/evidence/capture allowance, separately measured
launcher events/stderr and future growth, separate Codex session and future
growth, plus 8MiB reserve inside the allocation. Installed tools and read-only
donors/object stores are separately identified standing dependencies.
`admission.json` records actual worker PID/argv: gpt-6.1-sol medium, 200000
TOTAL automatic compaction, launched by the coordinator. No workers spawned.

The guarded verifier used CPU/wall 60s, regular-file 24MiB, cumulative capture
512KiB, overflow exit 125, TERM then KILL after 5s, Linux subreaper and complete
descendant reaping. Its actual exit was 1, no resource denial, captured 429 bytes,
and no remaining descendants. Publication uses the same bounded runner; exact
argv, exit, raw streams and reaping receipts are adjacent. Raw text is encoded
as JSON strings to preserve bytes without incidental trailing-space failures.
`publication-admission.json` records the final measured projection;
`seals.json` binds prepublication evidence. Post-seal publication receipts,
actual remote SHA and committed seal verification are retained externally at
`/home/user/wine-assembly/scratch/usage-watch/shadow-man-patch-bound-static-accept-oct23/publication.json`.

One coherent report/evidence commit is published to private task branch
`task/shadow-man-patch-bound-static-accept-oct23`, using the existing strict
known-host/key SSH configuration, GIT_NO_LAZY_FETCH and actual remote SHA
readback. No force push, main mutation, merge or deployment is authorized here.
Git does not back up ignored modules; retained canonical recovery evidence is
reused without packaging/build work.

POSITIONT/shared integration, RichEdit, Claude B&W2 and laptop ownership remain
untouched. No production source, donor, shared index/ref, compiler, Node, native
Module/Memory/Instance/arena, Boat, browser, guest or runtime operation occurred.
No box assigned: ID/state/expiry N/A; lifecycle belongs to the coordinator.
Native validation, engine compilation, guest configuration/play behavior and
game acceptance remain unqualified. This bounded worker stops after publication.
