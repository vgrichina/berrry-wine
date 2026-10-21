# Independent acceptance: REJECT

Candidate: `f8f9785c99cf121cca22ca7c1560903a5e403005`, remote
`task/callback-token-concurrency-oct21`. Reviewed against freshly verified
remote main `bc53c1d1cbd1da82f44835cda31e193a52a63aa8`.
No integration, production correction, or candidate checkout edit was performed.

## Blocking test defect

In `test/test-callback-invocation-concurrency.js`, lines 181, 193 and 205 use
`Buffer.from(memory.buffer)` as a before snapshot. That overload shares the
SharedArrayBuffer backing store. Comparisons at lines 183, 195 and 208 therefore
compare two views of the same current bytes, not before/after contents.
These checks cannot establish whole-memory preservation across overflow and
mismatched leave, stale-owner rejection, or the all-exhausted phase.

Run `node scratch/runs/20261021-callback-concurrency-independent-integrate/reproduce-snapshot.js`.
It changes the shared serial from 42 to 43 after taking the candidate snapshot:
the exact candidate comparison passes, while a genuinely copied snapshot
rejects the change. Exit 0 means the false-negative defect was reproduced.
This is a test-oracle defect, not evidence of an actual production allocator bug.

The worker-local snapshot at line 78 uses `Buffer.from(new Uint8Array(...))`
and does copy its owner's slot bytes. Its globals and slot checks remain useful,
but deliberately exclude the shared header so concurrent changes by other owners
are not mistaken for corruption. Consequently they cannot rescue the ineffective
whole-memory checks. A serial change during an all-rejected overflow phase is
exactly the kind of mutation the missing check should detect.

The candidate report's claims that complete all-rejection phases and the
subsequent exhausted phase preserve the entire memory are not established by
these tests. The earlier producer PASS is not independent acceptance. Correct
the snapshots to copies and demonstrate rejection of an injected shared-state
change before resubmitting; this bounded review intentionally does not repair
or integrate a substantially defective acceptance test.

## Other findings and independent execution

The positive module extracts the delimited production block without mutation.
`src/04-cache.wat` and `tools/test-tiers.js` are identical between exact main and
candidate. Four distinct Node workers receive one shared WebAssembly.Memory,
with instance slot owners 1–4 and parent slot 0. Ready/release and completion
barriers maintain one executor per slot; resets and boundary injection occur
after workers complete. The freshness set spans workers and waves. Per-owner
rejection snapshots avoid conflating another owner's allocator writes.

Both controls use the corresponding positive oracle: forced load/store races
fail freshness; removal of the terminal guard fails exhaustion. The control
mutations match exactly once. Normal round failures reach worker termination
in finally; round/barrier and termination waits have 15-second bounds. Runs
also use an external 90-second timeout. No failure-path fault campaign was run.
Unit membership follows the existing filename convention, verified by
`classifyTest`, without changing a tier manifest.

One independent focused execution (Node v24.18.1):

- `node --check test/test-callback-invocation-concurrency.js`: exit 0.
- `timeout 90s node test/test-callback-invocation-tokens.js`: exit 0, PASS.
- `timeout 90s node test/test-callback-invocation-concurrency.js`: exit 0;
  four worker IDs, 2,035 roots/children, seven terminal allocations and 25
  rejections; both broken controls rejected. This PASS does not cure the defect.
- Snapshot reproducer: exit 0, false-negative confirmed.
- Existing `classifyTest` assertion: exit 0, unit.

Exact command arrays/results and output are in `tests.json` and `check-*.log`.
Producer admission/tests/publication and original logs were read in place from
the shared `scratch/runs/20261021-callback-token-concurrency/` evidence.
Fresh sparse projection was 886,462 bytes, with admission and protected root
hashes in `admission.json`; no dependencies were installed. The review branch
starts at main and adds only this small review/evidence directory. The candidate
test was materialized untracked solely for execution; it is not integrated.

Scope is source-only allocator testing under quiescent lifecycle preconditions.
No Windows conformance or Circus gameplay acceptance, builds, boxes, browser,
downloads, deployment, workers, or API/review-lock changes. No box assigned;
all boxes stopped per coordinator, lifecycle ownership unchanged.
