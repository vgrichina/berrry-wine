# D3D resource crash sweep, 2026-11-01

The original six requested native Node/Wasm tests ran sequentially: five passed and
device enumeration failed a stale capability assertion. No native trap,
process signal, timeout or production crash was observed. No source repair
or test edit was made.

Baseline: `22992d60efb01985e5c55f9fdd2572e5c3732657`. Actual HEAD for all six
tests: `f3fedefac7271983e6a02321629620efabcbd283` on shared main. The intervening
changes affect only `TODOS.md` and `ops/STATUS.md`. The new runner records
actual HEAD and verifies documentation-only advancement and input identities;
it does not require HEAD equality.

| Test (`test/`) | Exit | Seconds | Observed coverage |
| --- | --- | --- | --- |
| `test-d3d-root-lifetime.js` | 0 | 5.336 | D3D1/2/3/7 references; six device-parent release orders, ABI and heap balance |
| `test-d3d-render-lifetime.js` | 0 | 18.679 | Direct/sparse retirement, adoption, coalescing, malformed lists, bins, passive diagnostic preserving complete memory and mutable globals |
| `test-d3d-device-enumeration-lifetime.js` | 1 | 3.687 | All 16 nested version pairs completed; failed during first D3D1 cycle, before its first callback resume |
| `test-d3dim-execute-buffer-lifetime.js` | 0 | 3.952 | Eight cached/uncached public creation, Lock, reference and final-release cycles; payload/cache balance and ABI |
| `test-d3dim-texture-release-arena.js` | 0 | 4.222 | Texture/Texture2 teardown, raw-free negative control, color-key refund, 100 balanced arena cycles |
| `test-d3d9-depth-release.js` | 0 | 6.158 | Actual x86 parked depth/backbuffer release and Reset, delayed failure/retry, immutable resize snapshot, balanced RET and shared serial exhaustion |

Enumeration failed at `test/test-d3d-device-enumeration-lifetime.js:77`:
`legacy filter caps unchanged`, actual 195 (`0xC3`), expected 255 (`0xFF`).
Compilation, instantiation, fixture loading, nested callbacks and their
allocation-balance assertion had succeeded. Static review identifies a test
expectation mismatch: `$fill_primcaps` in
`src/09a8-handlers-directx.wat:3629` explicitly excludes unsupported legacy
mip filters and writes `0xC3`. The same test's later real-x86 assertion at
line 157 already expects legacy `0xC3`. This is a harness assertion failure,
not evidence of a resource-lifetime production crash. The 96-cycle sweep did
not complete, and all 32 later real-x86 nested enumeration cases remain
unexecuted. No retry or diagnostic execution was needed for this classification.

Evidence is ignored under
`scratch/runs/20261101-d3d-resource-crash-sweep-run2/`. It contains the new
`run.py`, per-test merged stdout/stderr logs, commands, elapsed times, exit
codes, environment, HEAD identities, static contract excerpt, outcomes and
`result.json`. Each command used `timeout 120s node --require
<run>/capture-module.cjs test/<name>.js`. The hook preserves the bytes and
SHA-256 of each byte-based Wasm instantiation, then delegates unchanged.
Ten byte captures cover six distinct test modules; the depth test also
instantiates its existing compiled module for a sibling instance.
`module-identities.json`, per-test `.modules.jsonl` and `.loaded-modules.json`
retain exact test-module and loaded dependency identities.

The prerequisite inventory was reused from
`scratch/runs/20261101-d3d-resource-crash-sweep/` and freshly checked:
all 1,167 source/compiler/host/helper/test/fixture/build files match the prior
inventory and remain unchanged before/after execution. All 1,163 tracked
inputs match baseline Git blobs; the other four are ignored notepad/calc
fixtures and the primary/compatibility builds. All 46 loaded repository module
hashes also match baseline. Full SHA-256 and sizes are in
`inputs-before.json`, `inputs-after.json` and the identity summaries.
The existing primary build remains 2,025,029 bytes, SHA-256
`2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`.
Each test uses the canonical WATX closure/compiler through the render harness
with its existing test exports and `fonts: 'none'`; no artifact override,
compiler/census bypass or new full build is claimed. Both PE fixtures exist;
no missing dependency blocked execution.

The first attempt ran no tests: its obsolete exact-HEAD assertion rejected
coordinator documentation commit `e58f596a4b33fe72d28ed79ab3fd2a34b4558281`
against requested `00072255dd3d38df6e4d87935da9b1d9a7f17dd7`. Its original
prerequisite/failure evidence remains intact in the prior run directory.
The present results replace that blocker under the explicit identical-input,
documentation-advancement allowance.

Environment: Linux x64, Node 24.18.1, V8 13.6.233.17-node.50; no WINE_* or
NODE_OPTIONS overrides. Free disk stayed above 2 GB (final 2.506 GB).
Only this findings document is committed; documentation diffcheck is the
publication check. No production/test/compiler/census, TODO/STATUS or foreign
WIP files were edited. No REP tests or diagnostics, held-topic work, browser,
heavy runtime, benchmark, download, access retry, boat or worker was used.
Box ID/state/expiry and lifecycle are N/A; no box ownership to hand back.

Next: separately scoped reconciliation of the enumeration test's stale
capability expectation, followed by its remaining coverage. No gameplay,
full27 or all-app crash-free conclusion is supported. This worker stops after
publishing this single task.

## Enumeration assertion reconciliation

Follow-up run: `20261101-d3d-enumeration-assertion`. The one-line legacy
callback assertion now requires exactly `0xC3` instead of `0xFF`, with a
message identifying the excluded legacy mip filters. No lifetime, ABI,
ordering, cancellation, canary or allocation assertion was removed or weakened.
All 16 nested version pairs, 96 balanced cycles and 32 real-x86 nested
COM/continuation cases now complete (exit 0, 5.246 seconds).

This correction follows the existing contract rather than changing production:
commit `7fec2dd33634f7ce76950cdecec8870ea29508d3` deliberately changed
`$fill_primcaps` from `0xF3` to `0xC3`, excluding legacy mip bits
`0x04..0x20`. That commit updated this harness's D3D7 and real-x86
expectations but left line 77 at `0xFF`. Current source, the later real-x86
assertion and both extracted filter regressions require legacy `0xC3`.
The unchanged harness first reproduced the exact line-77 failure
(`195 !== 255`, exit 1); the corrected harness then passed in full.

Validation has a separate, pre-existing blocker: the unmodified
`test-legacy-texture-filter-caps.js` fails at line 121 and
`test-legacy-final-mip-bits.js` at line 126, both reporting
`texture ops unchanged`, actual `0xF`, expected `0x3FF`. Their legacy filter
and preceding descriptor checks pass, but their later checks and mutation
negatives do not complete. The final-mip test also prints its 36 backend
state cases before failing. Neither regression is claimed as passing.
Production explicitly advertises `0xF` at descriptor offset 180; history
`f42083c61a18d56fd739d3cd702c4d67d36784b7` documents the accepted
DISABLE/SELECTARG1/SELECTARG2/MODULATE mask. The unchanged newer
`test-legacy-texture-operation-caps.js --negative-controls` passes its
9 pairs, 144 argument combinations and 15 rejecting controls. No production
contract bug was established. Repairing the older regressions is outside
this task's file ownership; their stale operation-mask checks remain open.

Mandatory `flock /tmp/wine-build.lock bash tools/build.sh` passed in
48.565 seconds, wrapped in `timeout 120s`. All native test commands also
used 120-second timeouts. The five previously accepted resource tests were
not rerun. No REP tests or diagnostics or other held-topic work ran.

Baseline was `4e67faf1ea2e6d435c7fae93c51eba549ae0bf79`; initial HEAD
matched it, and subsequent tests ran at
`62693ec240f9b8842e2be796da0b09b3f34de5b5`, whose only intervening
changes were `TODOS.md` and `ops/STATUS.md`. The 1,169-file input inventory
matches baseline/prior evidence before correction; afterward only the owned
enumeration test changes, including byte-identical primary/compatibility
builds. Exact per-file SHA-256, loaded module identities, commands, exits,
logs, source/history excerpts and the minimal patch are retained in the
ignored run directory. Before/after enumeration captures are identical:
2,025,153 bytes, SHA-256
`001c726c332311bf570ebf9fff67e04608c407d7ff3f80c5c3f9aba5e0611617`.
The rebuilt primary module remains 2,025,029 bytes, SHA-256
`2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`.

Linux x64 / Node 24.18.1; no WINE_* or NODE_OPTIONS overrides. Disk remained
above 2 GB. No source/compiler/census, foreign WIP or TODO/STATUS edits,
browser/heavy runtime, download, access retry, deployment, agents or boxes.
Box ID/state/expiry and lifecycle are N/A. Coverage is limited to the named
harnesses, with the two caps-regression failures explicitly unresolved.
Next: separately scoped correction of those regressions' stale operation
mask assertions; no broader compatibility claim follows from this run.

## Filter and final-mip assertion reconciliation

Run `20261101-legacy-filter-assertions` resolves the two older regression
failures above. Each test changes only its D3D7 descriptor offset-180
expectation and message: `0x3FF` becomes exactly `0xF`, identifying
DISABLE/SELECTARG1/SELECTARG2/MODULATE. All filter, backend, guard, ABI and
mutation assertions remain intact. No production change was needed.

History `f42083c61a18d56fd739d3cd702c4d67d36784b7` deliberately added
DISABLE to the previous `0xE` mask. The current 236-byte D3D7 descriptor
stores `0xF` at offset 180, followed by the two 16-bit stage/texture limits
at 184/186; this field is separate from the line/triangle filter caps at
40/96. The production combiner terminates stage zero on DISABLE and handles
SELECTARG1/SELECTARG2/MODULATE; the newer regression checks those operations,
unsupported-operation fallback, argument handling and GPU lowering. This
contract and the prior recorded failures justify the correction.

All three native tests ran sequentially with `timeout 120s node --require
<run>/capture-module.cjs test/<name>.js`; only the operation test takes
`--negative-controls`. The older tests execute their negative controls
unconditionally (their optional positional argument is a DirectX source path).

| Test | Result | Completed coverage |
| --- | --- | --- |
| `test-legacy-texture-filter-caps.js` | PASS | 90 descriptor fields, 36 software/GPU filter cases, point/bilinear footprints, all 6 mutation negatives |
| `test-legacy-final-mip-bits.js` | PASS | 90 descriptor fields, 36 backend cases, real WAT pixel fetch/decode on two bound images, all 10 mutation negatives |
| `test-legacy-texture-operation-caps.js --negative-controls` | PASS | 9 operation pairs, 6 unsupported-operation fallbacks, 144 argument combinations, all 15 rejecting controls |

Mandatory `timeout 120s flock /tmp/wine-build.lock bash tools/build.sh`
passed in 44.589 seconds; focused tests took 0.278, 0.292 and 0.639 seconds,
respectively. Own-path diffcheck passed. The primary build remains byte
identical: 2,025,029 bytes, SHA-256
`2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`.

Baseline `168c9a6369253f7627bb5d6f105888020ed0fd6a` and tested HEAD
`91c02f1c36059b06a866879f6a3b81a12254fd33` differ only in `TODOS.md` and
`ops/STATUS.md`. Before correction, all 1,169 inventory files match the prior
run's final inventory and relevant tracked inputs match baseline. Ignored
evidence retains exact commands, outcomes, environment, before/after input
hashes, loaded module identities, captured Wasm bytes and SHA-256, source and
history excerpts, and the patch. The capture hook delegates module creation
unchanged and records mutation modules as well as the passing fixtures.
After validation, only the two owned tests differ across the input inventory;
all 10 loaded repository modules match baseline except those two corrections.

Coverage remains extracted production source with fixture memory and GPU
descriptor/lowering checks, without a graphics context or full guest runtime.
Enumeration wiring is checked statically here; accepted lifetime/enumeration
tests were not rerun. No additional production issue was observed. No REP
tests or diagnostics, held-topic work, foreign WIP edits, compiler/census
changes, browser/heavy runtime, boats, downloads, access retries, agents,
successors or deployment. Disk stayed above 2 GB. Box ID/state/expiry and
lifecycle are N/A, with no runtime ownership to hand back.
