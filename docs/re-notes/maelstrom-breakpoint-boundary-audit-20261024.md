# Maelstrom executable breakpoint-boundary audit

The missing diagnostic from published closeout
`e82ff8b10b319428ecf9a8d452c201ad93d24ca3` is now implemented and tested
offline. Runtime reachability of guest VA `007a3366` and the historical
zero-record cause remain **UNPROVEN / UNKNOWN**. No guest, WASM instantiation,
native execution, browser, build, box operation or networking repair occurred.

`tools/maelstrom-breakpoint-boundary-audit.cjs` transforms the **actual**
historical `test/run.js`, SHA256
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`, at
`d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e`. The canonical donor's Git blob
and retained capture source agree. Exact gzip copies, original byte sizes,
hashes and provenance are in the adjacent evidence directory. This is a
diagnostic adapter, not a changed production runner or emulator.

## Behavior and supported semantics

Disabled transformation returns the input byte for byte: no extra reads,
calls, logging, changes to run returns, budgets, clocks, pacing, argv, inputs,
guest/module selection or rendering. Enabled transformation requires the
pinned runner hash, exactly one occurrence of each of five injection anchors,
and the retained `13-exports.wat` SHA256
`739397dc54a77e93b367334fd4ca96c921180f57a7558913a3301f1de4520b86`.
Changed or ambiguous inputs fail closed. Output creation is exclusive and
adjacent to the input so relative imports retain their directory.

At batch 36163, the adapter validates the exact single-PC trace recipe,
limit 1, memory expression `eax:4,esp+0x124:12` and batch size 1000. It requires
`set_bp`, `get_bp_addr`, `get_eip`, `get_last_run_halt`, `get_eax`, `get_esp`
and `guest_read8`; missing exports fail explicitly before the original optional
arming branch can silently skip. Immediately after the runner's existing main
`set_bp` invocation, it emits the actual argument and readback and rejects an
incorrect readback. Existing cooperative-thread arming remains in place.

Immediately after the existing main `run(BATCH_SIZE)` returns, inside the same
try block and before any post-run host/render/scheduler work, it reads EIP,
halt code, breakpoint readback and unchanged batch size. It records the chain
guard using the source-proven `test_arena_get(11)` when available; absence is
explicit with null value. It never substitutes `get_dbg_tier_guard`, which is
a different guard. The already configured count slot for guest `007a3362` is
read only if that address and `get_count` are available. These optional reads
do not create counters, arm additional breakpoints or modify guest state.

Only halt **5** is decoded as `eip-breakpoint`: the pinned run loop writes 5
when its EIP breakpoint halts. Every other numeric code is retained raw and
labelled `unclassified`; no unsupported enum is invented. Only EIP `007a3366`
AND halt 5 admit a target record. Before resuming or host work, it reads exactly
four bytes at EAX and twelve at ESP+0x124 through `guest_read8`. It emits at
most one target. It does not infer errno, callers or CheckSockets iteration
counts from unrelated parked observations.

Output goes directly to stderr, outside the runner's windowed `console.log`.
At most four JSON lines / 8192 bytes are emitted: arm, first main return,
optional target, terminal summary. Later main returns update one constant-size
last-return record without per-batch output or history accumulation. Normal
budget/loop exit produces an unresolved summary if no target was observed,
including whether arming happened. Existing runner crash handling still exits
on explicit audit errors; no successful summary is fabricated after a crash.
The audit does not call `run`, coerce its discarded return, change batch size,
resume the guest, alter max batches, or instrument auxiliary run sites.

## Acceptance evidence

```
node --max-old-space-size=256 test/test-maelstrom-breakpoint-boundary-audit.js
```

The new test is convention-classified **unit**; `tools/test-tiers.js` is
unchanged. It parses the entire transformed historical runner, then executes
exact extracted transformed init/arming/main-run/render/scheduler/finish
fragments with controlled exports. It is **not execution of the full runner or
a guest**. Actual runner render and scheduler fragments deliberately mutate
EIP, halt and counters; the target snapshot must precede those mutations and
the next run. The ordinary path has identical guest/host invocation sequences;
the default transform is byte-identical. An opaque run return rejects coercion.

Tests cover successful invocation/readback/guard/target/snapshot, seven missing
required exports, incorrect arm/post-run readbacks, conflicting breaks, changed
batch size, missing optional guard/counter, matching EIP with wrong halt,
suspended main, early budget exhaustion, 10,000 no-hit batches with finite
output, wrong runner/semantics hashes, ten missing/duplicate anchor cases,
executable CLI generation and refusal to overwrite existing outputs. Seven
rejecting mutations prove that the oracle detects omitted arm receipt,
omitted post-run observation, forced one-block calls, shifted memory reads,
host mutation before observation, false halt acceptance and fake readback.

The adjacent `test.json` retains the controlled records and unresolved
summary. `runner-injection.diff`, `code-identity.json`, source provenance,
canonical Git identity and CLI output identity make the change reviewable.
Fresh Node tests used heap 256 MiB, CPU/wall 60 seconds and measured
MemAvailable >=805306368. The first test failure (fixture changed batch size
before arming) remains in task-root `test-first.json`; the test now mutates
only after actual arming. No production guard was weakened.

The exact previous **25 primary seals, 23 recovery seals and nine offline
controls** were reverified without recapture; `prior-controls.json` and the
unchanged seal manifests retain this receipt. Historical raw capture and
denial receipts remain in their original root and published evidence bundle.
Previous static eligibility is not promoted to runtime acceptance.

## Next use and existing gates

For the next offline generation, use this fresh adjacent output name (the
same command with output `run.boundary-audit.js` was already tested):

```
node --max-old-space-size=256 /tmp/maelstrom-breakpoint-boundary-audit-oct24/repo/tools/maelstrom-breakpoint-boundary-audit.cjs --enable /tmp/maelstrom-breakpoint-boundary-audit-oct24/next-use/test/run.js /tmp/maelstrom-breakpoint-boundary-audit-oct24/next-use/test/13-exports.wat /tmp/maelstrom-breakpoint-boundary-audit-oct24/next-use/test/run.boundary-audit.next.js
```

The tested output `run.boundary-audit.js` exists and is retained for review;
replay with that same output correctly refuses overwrite. Its SHA256 is
`4bb39d78d356a3aff2924ed4f2a157825eead99b30f85d949d46da102bd2c6c8`.
For a new offline generation choose a new adjacent output name. The staging
directory contains only diagnostic source, not an executable guest dependency
closure. Restore the original retained runner dependency manifest before a
separately assigned runtime attempt; use the generated file adjacent to that
runner. The original capture argv, module identity, mounts (including commas),
input schedule, clock, pacing PASS=1000 and 42000-batch budget remain the
reference. The numeric target is already translated from the DLL's preferred
base to guest VA; do not apply `g2w` to the breakpoint.

The historical `preload.cjs` recognizes only its original runner filename and
requires its original source hash before adding SELECT-OBS. It must **not** be
blindly stacked around transformed source: that either bypasses its observer
on a sibling filename or rejects the new hash. This task does not change that
readonly helper. A coordinator must bind any combined preload/capture wrapper
and its ordering before runtime, rather than silently dropping that observer
or weakening its identity gate. The new audit independently reads the existing
select-return counter, without claiming the older observer ran.

Runtime requires a new coordinator assignment, actual module/export identity
and startup-gate checks, exact mount argv validation by the canonical parser,
fresh disk/session/SQLite/reserve and memory admission, bounded terminal output
and first-rejection stop controls. Missing required APIs are a concrete
compatibility blocker. A future target record still requires inspection to
interpret native errno/caller/branch. No runtime attempt is authorized by this
report.

## Publication and ownership

Only `task/maelstrom-breakpoint-boundary-audit-oct24` is published; no main
merge or public deployment. The supplied trusted SSH configuration verified
remote main `979042c93eec78095d0e4ee078d4efb25a55a5ff` and prior task commit
`e82ff8b10b319428ecf9a8d452c201ad93d24ca3` before checkout. Later unrelated
main movement is not integrated. Root tracked/index/refs, donors and original
inputs remain readonly, with append-only messageboard coordination.

Task-root admission, full external session/event/history accounting, positive
SQLite growth, standing-tool/input accounting, diffs, publication/actual remote
SHA and cleanup receipts accompany the final ops result written last. Initial
projected allocation was 56104886/67108864 bytes including 8 MiB reserve;
later measurements retain that history. Nonfatal Git nested-alternate warnings
are retained separately; no access/resource denial was retried or hidden.
The bounded board watcher stops before completion. No box is assigned; prior
boxes are coordinator-confirmed stopped, and lifecycle ownership remains with
the coordinator. The worker stops after verified task-branch publication.
