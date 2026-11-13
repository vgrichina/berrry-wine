# Closed canonical rollout recovery: eligibility blocker

No canonical rollout was opened, compressed, or removed. Reclaimed bytes: **0**.
Evidence: `scratch/runs/20261113-closed-canonical-rollouts/` (ignored).

The read-only audit found exactly 24 processed completion entries after
2026-11-12T22:00:00Z and 24 matching filename UUID paths totaling 146,043,212
logical bytes. That is an upper bound, not reclaim or verified eligibility.
`eligibility.json` preserves each explicit path, task, completion timestamp,
review receipt path/hash and metadata without reading rollout payloads.

None passes the required positive wine-worker launcher-exit-0 plus final-present
evidence gate. Twenty-three canonical root-review receipts do not record both
facts. The remaining receipt, for worker
`01a1d201-fe82-7792-a61e-4802f070d6af`, explicitly records `launcherExit: 1`
and `finalReport: MISSING`. Native browser/controller exit status and successful
artifact review cannot substitute for the worker launcher outcome.

The task forbids reading usage-watch events/result/final. Those files were not
opened. The completion ledger and its referenced root-review JSON receipts
cannot supply the missing positive facts. No eligibility was inferred from
filename, file age, publication, successor assignment, or notification delivery.
Later session-meta identity, complete-last-record, stable metadata, privileged
process-reference, encoding and restore gates were therefore not attempted.
No session log paths were claimed for mutation because none reached eligibility.

Actual available `/home` space was 1,485,262,848 bytes at entry; the measured
post-audit sample is recorded in `outcome.json`. Shared filesystem movement is
not attributed to this task; there is no continuous floor claim.

Validation: read-only audit and six cutoff/type guard assertions passed.
`audit.py` and its full new-file patch are retained only in the ignored run;
the exact Git base SHA is in `git-head.txt`. No production code changed, so
the production build was not run. No source/media archive was created.

Next: supply a permitted durable per-worker receipt binding UUID, wine-worker
start-worker execution, actual exit 0, final presence, and canonical review.
Then recheck current registry/dependencies and every remaining safety gate
before owning and compressing any exact path. Preserve all encoded bytes and
recovery indexes; RESTORE the original raw path and verified hash/mode/mtime
before any future closed-thread resume or history-file consumer. Workers must
never be reused.

No box was created or resumed. Box ID: none; state: NOT_CREATED; expiry: none;
stop receipt: not applicable. The task's board watcher has an independent
1,800-second timeout and is explicitly stopped at closeout.
