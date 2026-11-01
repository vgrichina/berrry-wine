# Thread-send constructor initialization repair — 2026-11-01

The constructor setup failure is reproduced and causally repaired in the shared
working tree. The original scoped-yields suite now passes unchanged for Worker
and local endpoints. **The code repair is not committed:** the mandatory build
stopped at a distinct callback ownership census gate failure. No census edits,
assertion changes or further runtime repairs were attempted.

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

## Before/after evidence and stopping point

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
failure. Updating the callback ownership census is explicitly outside this
assignment. The first-failure stop rule was applied immediately; scheduler and
park checks were not refreshed after this failure. Their previously accepted
results are historical evidence only because this repair changes their
`ThreadManager` dependency. The accepted native continuation PASS (4.751 s,
run `20261101-d3d-render-wait-crash-sweep`) is reused: all 63 dependency hashes
in the accepted scheduler-repair evidence still match, recorded in
`native-evidence-reuse.json`. No native continuation rerun was needed.

Logs and terminal results are retained as `before.*`, `after.*`,
`options-contract.*`, `build.*` and `result.json` in the evidence root.
There is no passing-build or published-code claim. The one-line relocation in
`lib/thread-manager.js` remains uncommitted WIP for the coordinator to recover.

Next: separately authorize the census lifetime review/update, or decide how to
handle the preserved WIP; then obtain a passing locked build and refresh the
affected focused checks before committing code. No further work is launched
by this worker. Disk remained above 2 GB. Box ID/state/expiry and lifecycle:
N/A; no boxes were assigned or touched.
