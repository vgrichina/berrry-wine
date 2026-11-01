# Thread-send constructor initialization repair — 2026-11-01

The constructor setup failure is repaired by moving the existing options
normalization before its first read. The matching callback census entry has
been reviewed and updated; the mandatory locked build and all four focused
checks pass. The original test/helper files and all assertions are unchanged.

## Landing validation and lifetime review

Landing run: `scratch/runs/20261101-thread-manager-options-land/` (ignored).
The released WIP came from documentation commit
`8e86339291d61abde911019ebd0bca4cd06c0650`; validation started at
`19c4681a8a01a5ef55c9e5fb06d0340514c541ea` on shared `main`.

The complete production delta is the relocation of `opts = opts || {}` from
below `_quietTM` to the constructor's first statement. Supplied options and
callback identities remain intact. No callback entry, saved context,
continuation, readiness, cancellation, retirement, unwind or restoration path
changes. Missing/null options now reach the existing initialization defaults.

Only `lib/thread-manager.js:host-file` in
`tools/callback-ownership-census.json` changes: its SHA-256 advances from
`2f866f9524ba605b74a157eb4830bd0a4534ad87bc5f5c2d8689755dd273cca5` to
`e23fd03ca018e1b1d86b67b82a2ac689508473678663a1e25c24d1a4048b8856`,
and its reason gains this lifetime review. The original reason is preserved
as a prefix. All other entries, fields and holds are unchanged; ownership
remains `pending`. Bootstrap timeout/error retirement and general nonlocal
ownership remain unresolved. No global regeneration or gate bypass occurred.

| Landing check | Result | Seconds |
| --- | --- | --- |
| `flock /tmp/wine-build.lock bash tools/build.sh` | PASS | 40.431 |
| Original `test/test-thread-send-scoped-yields.js` | PASS, Worker and local | 0.439 |
| Original `test/test-d3d-render-wait-scheduler.js` | PASS | 0.034 |
| Original `test/test-d3d-render-park-batches.js` | PASS, fixed 1 wait/0 skipped; legacy 39 skipped | 0.929 |
| Optional-options probe | PASS, omitted/undefined/null/empty and explicit identities | 0.031 |

Focused checks ran sequentially with `timeout --kill-after=5s 120s node ...`.
Child limits were inspected: park-batches runs two CLI children sequentially,
each with `--max-seconds=45`, a 90-second SIGTERM deadline, finally cleanup,
and exit-zero assertions. The timeout bounds the process group. Scoped-yields
uses sequential Worker endpoints closed in finally; the scheduler is mocked.
The retirement helper is imported for `context` only; its guarded main and
`prerequisites` were never executed.

The accepted native continuation PASS (4.751 seconds) is reused from
`20261101-d3d-render-wait-crash-sweep`: all 63 recorded dependencies still
match. No unrelated native rerun or expanded inventory was needed.
`census-review.json`, `reviewed.patch`, `unchanged-tests-helper.json`,
`native-evidence-reuse.json`, `limits-review.txt`, build/test logs and exit
records retain the review and validation evidence. Box ID/state/expiry and
lifecycle: N/A; no boxes were assigned or touched.

## Optional-options contract and minimal repair

Requested baseline: `faaefe898df171f47e580d4e08b9d1e8d9a98b29` on `main`.
The concurrent advance `734ddda375eb1f185ba90c5cbd2e477cd6352a35` changes only
`TODOS.md` and `ops/STATUS.md` from that baseline.

`ThreadManager` already normalizes `opts` with `opts = opts || {}` before
initializing most options. That establishes defaults for omitted, undefined
and null options. Existing callers omit options, including the retirement
helper's `context` and `test/test-thread-wait-zero-timeout.js`. However, the
constructor reads `opts.callbackLifecycleTrace` before that normalization.
The helper therefore throws before any callback assertion executes.

The sole code change moves the existing normalization to the beginning of the
constructor, before its first option read. Explicit options and trace/readiness
object identities are retained. Supplying `{}` only in the helper would mask
the constructor's inconsistent optional-options contract for other callers.
Neither the helper nor `test/test-thread-send-scoped-yields.js` is edited.
All callback ownership, readiness, retirement, stale-epoch and outer-frame
assertions remain intact.

## Historical before/after evidence and first handoff

Evidence root: `scratch/runs/20261101-thread-send-helper-init-repair/` (ignored).

| Check | Result | Seconds |
| --- | --- | --- |
| Original scoped suite before repair | FAIL, exit 1, constructor line 63: undefined `callbackLifecycleTrace` | 0.433 |
| Same unchanged scoped suite after repair | PASS, exit 0, Worker and local | 0.757 |
| Focused options contract | PASS, exit 0 | 0.050 |
| `flock /tmp/wine-build.lock bash tools/build.sh` | FAIL, exit 1, census gate | 3.266 |

Both scoped runs used exactly:

```sh
timeout --kill-after=5s 120s node test/test-thread-send-scoped-yields.js
```

Before execution, inspection established that the scoped suite imports only
the retirement helper's `context`. The helper's `main` is guarded by
`require.main === module`; neither it nor `prerequisites` was called. The tiny
Wasm fixture is synthetic, with no guest binary or held-topic execution. The
suite creates Worker endpoints sequentially, closes them in `finally`, and the
outer process-group timeout bounds the process and its worker threads. No
subprocesses are spawned by this suite. Both runs terminated without timeout
or signal. The options probe separately checks omitted, undefined, null and
empty options plus explicit trace and readiness identity.

The build passed the CLAUDE size, source manifest and fragment checks, then
failed with:

```text
changed producer lib/thread-manager.js:host-file (sha256); review its lifetime
```

This is a distinct build acceptance failure, not a scoped-yields assertion
failure. Updating the callback ownership census was explicitly outside that
first assignment. The first-failure stop rule was applied immediately; scheduler and
park checks were not refreshed after this failure. Their previously accepted
results are historical evidence only because this repair changes their
`ThreadManager` dependency. The accepted native continuation PASS (4.751 s,
run `20261101-d3d-render-wait-crash-sweep`) is reused: all 63 dependency hashes
in the accepted scheduler-repair evidence still match, recorded in
`native-evidence-reuse.json`. No native continuation rerun was needed.

Logs and terminal results are retained as `before.*`, `after.*`,
`options-contract.*`, `build.*` and `result.json` in the evidence root.
At that first handoff there was no passing-build or published-code claim;
the one-line relocation remained uncommitted WIP for the coordinator to recover.

The subsequent landing assignment authorized the specific census review and
completed the build and focused checks recorded above. Disk remained above
2 GB. No retirement repair or broader ownership completion is claimed.
