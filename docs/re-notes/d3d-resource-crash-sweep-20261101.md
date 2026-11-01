# D3D resource crash sweep, 2026-11-01

All six requested native Node/Wasm tests ran sequentially: five passed and
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
